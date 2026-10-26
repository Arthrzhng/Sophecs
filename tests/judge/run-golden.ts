// Runs the golden set against the real judge model and prints a table.
// Run before and after any change to the prompt or rubric — paste both
// tables when reporting a change, per the brief.
//
//   npm run judge:golden
//   GOLDEN_SAMPLES=1 npm run judge:golden         (quick, single-sample)
//   JUDGE_PROMPT_VERSION=v3 npm run judge:golden  (run a draft prompt)
//   GOLDEN_DRY_RUN=1 npm run judge:golden         (plan and cost it; no calls)
//                                                 (1/true/yes; anything unclear refuses)
//
// Requires an Anthropic API key in the environment, as SOPHECS_EVAL_KEY.
// Claude Code's cloud sessions withhold any variable named
// ANTHROPIC_API_KEY, so the eval key travels under its own name and is
// handed to the client here; see tests/judge/eval-key.ts. ANTHROPIC_API_KEY
// still works where it is not withheld. The key is read from the
// environment and nowhere else: the script does not load .env.local via
// Node's --env-file, because a file that is not there made the command
// fail before it could say what was missing. SUPABASE_SERVICE_ROLE_KEY is only needed
// under GOLDEN_LOG=ai_calls. One of three call sites for the Anthropic API
// in this repo: the others are /api/judge, through judgeDebate, and
// src/lib/screen.ts, which screens counterpart replies on
// claude-haiku-4-5. Two comments in this repository said two, including
// this one.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  callJudgeModel,
  logAiCall,
  JudgeValidationError,
  MODEL,
  PROMPT_VERSION,
  type RunnablePromptVersion,
} from "../../src/lib/anthropic";
import { planCase, readDraftCriteria, type CasePlan } from "./draft-criteria";
import { describeEndpoint, describeEvalKey, endpointProblem, resolveEvalKey } from "./eval-key";
import {
  flush,
  logTarget,
  recordCall,
  requestFingerprint,
  startRun,
  type GoldenRun,
} from "./golden-log";
import type { SchoolId } from "../../src/lib/types";

// Where a run logs. `file` writes tests/judge/golden-runs/<run>.json and
// touches nothing else; `ai_calls` is the old behaviour, kept for anyone
// who wants an eval to show up in the production ledger.
//
// `file` is the default on purpose. A judge run is not production spend,
// and logging to ai_calls made the run need a route to Supabase that an
// eval box has no other reason to have. Production logging is unchanged:
// judgeDebate still writes to ai_calls and nothing in src/ imports the
// file sink. See tests/golden-log.test.ts.
const LOG_TO = logTarget(process.env.GOLDEN_LOG);

// Which prompt the run measures. The default is production's, so a bare
// `npm run judge:golden` is the baseline table; `JUDGE_PROMPT_VERSION=v3`
// is the second table. The brief's discipline is both tables, same cases,
// pasted side by side, and that needs two runs that differ in exactly this.
//
// Production cannot reach this: `callJudgeModel`'s version parameter
// defaults to PROMPT_VERSION and neither /api/judge nor judgeDebate passes
// one.
const RUNNABLE_VERSIONS = ["v1", "v2", "v3"] as const;

function resolveVersion(): RunnablePromptVersion {
  const requested = process.env.JUDGE_PROMPT_VERSION;
  if (requested === undefined || requested === "") return PROMPT_VERSION;
  const match = RUNNABLE_VERSIONS.find((v) => v === requested);
  if (!match) {
    throw new Error(
      `JUDGE_PROMPT_VERSION="${requested}" is not one of ${RUNNABLE_VERSIONS.join(", ")}`
    );
  }
  return match;
}

const VERSION = resolveVersion();

// claude-sonnet-5 rejects `temperature`, so sampling can't be pinned and a
// single sample per case is a coin flip on any argument sitting near a band
// edge — stoic-strong returned fidelity 7, 8, 8 on three consecutive
// single-sample runs against a band of 8-10. Three samples and a median
// measure the distribution instead of pretending it's a point value, at
// three times the cost. That was about 18p a run when the set was six
// cases; it is about $0.42 for the v2 run and $0.93 for v3 now, and the dry
// run prints the current figure. See docs/decisions.md.
const SAMPLES = parseSamples(process.env.GOLDEN_SAMPLES);

// A whole number of at least 1, or the run refuses to start. It used to be
// Math.max(1, Number(value)), which turned "abc" into NaN and a loop that
// silently never ran. There is no upper cap: how much one run may spend is
// Arthur's decision, so the run prints its planned cost before the first
// call instead.
//
// Digits only. Number() accepted "1e1" as 10, "0x2" as 2 and " 2 " as 2, so
// GOLDEN_SAMPLES=1e3 would have planned 14,000 calls, about $139, and
// started straight after printing it.
function parseSamples(value: string | undefined): number {
  if (value === undefined || value === "") return 3;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      `GOLDEN_SAMPLES="${value}" must be a whole number of at least 1, ` +
        `written in digits with no leading zero or spaces`
    );
  }
  return Number(value);
}

// Whether to stop before the first call. It used to be true only for the
// exact string "1", so GOLDEN_DRY_RUN=true, with a key present, would have
// made a real and billed run. A value that is clearly yes or clearly no is
// accepted; anything else refuses to start, because an unclear answer to
// "should this spend money" must not default to yes.
function parseDryRun(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  throw new Error(`GOLDEN_DRY_RUN="${value}" is neither yes nor no; refusing to guess`);
}

const DRY_RUN = parseDryRun(process.env.GOLDEN_DRY_RUN);

interface GoldenCase {
  name: string;
  motion: string;
  school: SchoolId;
  argument: string;
  expected_score_band: [number, number];
  // Both bands are optional, and absent means unconstrained rather than
  // zero. `fabricated-source` leaves fidelity open on purpose: v3 calls a
  // fabricated citation a rigor failure, and the Stoic reasoning wrapped
  // around the invented quotations really is the school's, so pinning
  // fidelity there would be testing the wrong axis. See
  // docs/phase2-fixtures.md.
  expected_fidelity_band?: [number, number];
  expected_rigor_band?: [number, number];
  // Needed by Tier B's known-weakness cases, where the expectation is high
  // fidelity and the loss taken on engagement: an argument that leans on
  // what the school's own critics object to is faithful, and what it owes
  // is an answer to the objection. Saying that without a band to put it in
  // would make it an untested sentence in a document.
  expected_engagement_band?: [number, number];
  // Case-insensitive terms, any one of which must appear in `weakest_move`
  // for a majority of samples. Added for `fabricated-source`, which Arthur
  // ruled passes on rigor 0-3 AND on weakest_move naming the invention. A
  // substring match is a proxy for "names it" and the terms are listed in
  // the fixture, so what counts is visible rather than buried here.
  expected_weakest_move_any_of?: string[];
  // The schools whose objection would be a legitimate one to raise against
  // this argument — always the two it was not written from. A set rather
  // than a single value on purpose: either rival is a defensible pick, so
  // pinning one would fail the run on a coin flip.
  expected_objection_school: SchoolId[];
}

interface Sample {
  score: number;
  fidelity: number;
  rigor: number;
  engagement: number;
  weakestMove: string;
  objectionSchool: SchoolId;
}

// A band is two numbers, low then high.
const Band = z.tuple([z.number(), z.number()]).refine(([lo, hi]) => lo <= hi, {
  message: "band's low bound is above its high bound",
});

// `strict()` is the point of this, not the types. An absent band now means
// "unconstrained", so a misspelled key would silently switch an axis off
// rather than fail: `expected_rigour_band` is a live risk in a repository
// that writes `normalise`, `behaviour` and `colourToken` everywhere else,
// and `fabricated-source` exists precisely to pin rigor. Passing the most
// important case in the set vacuously, after paying for three samples of
// it, is the failure this prevents.
const GoldenCaseSchema = z
  .object({
    name: z.string().min(1),
    motion: z.string().min(1),
    school: z.string().min(1),
    argument: z.string().min(1),
    expected_score_band: Band,
    expected_fidelity_band: Band.optional(),
    expected_rigor_band: Band.optional(),
    expected_engagement_band: Band.optional(),
    expected_weakest_move_any_of: z.array(z.string().min(1)).min(1).optional(),
    expected_objection_school: z.array(z.string().min(1)).min(1),
  })
  .strict();

function loadCases(): GoldenCase[] {
  const dir = path.join(process.cwd(), "tests", "judge", "golden");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const parsed = GoldenCaseSchema.safeParse(
        JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"))
      );
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        throw new Error(`golden fixture ${f} is malformed: ${detail}`);
      }
      return parsed.data as GoldenCase;
    });
}

// An absent band is unconstrained: the axis is still measured and still
// reported, it just cannot fail the run.
function inBand(value: number, band: [number, number] | undefined): boolean {
  if (!band) return true;
  return value >= band[0] && value <= band[1];
}

function bandLabel(band: [number, number] | undefined): string {
  return band ? band.join("-") : "any";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function spread(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min}-${max}`;
}

type RunnablePlan = Extract<CasePlan, { run: true }>;

async function logCall(
  run: GoldenRun | null,
  c: GoldenCase,
  plan: RunnablePlan,
  sample: number,
  costUsd: number,
  latencyMs: number,
  verdict: {
    score: number;
    fidelity: number;
    rigor: number;
    engagement: number;
    unanswered_objection: { school: string };
  } | null,
  raw: unknown,
  error: string | null
): Promise<void> {
  if (LOG_TO === "ai_calls") {
    await logAiCall({ userId: null, debateId: null, kind: "golden", costUsd, latencyMs });
    return;
  }
  // Unreachable at runtime: `run` is non-null exactly when LOG_TO ===
  // "file", and the ai_calls branch above has already returned. It stays
  // because it is what narrows GoldenRun | null to GoldenRun for tsc, and
  // the alternative is a non-null assertion that would hide a real null if
  // the two conditions ever drifted apart. A reviewer called it dead code,
  // which it is, and removing it fails the typecheck.
  if (!run) return;
  // Records and writes in one step, so the run survives a crash mid-way.
  recordCall(run, {
    sample,
    fixture: c.name,
    school: c.school,
    prompt_version: VERSION,
    criteria_source: plan.source,
    request_fingerprint: requestFingerprint({
      promptVersion: VERSION,
      promptText: promptText(),
      criteria: plan.criteria,
      motion: c.motion,
      school: c.school,
      argument: c.argument,
    }),
    model: MODEL,
    response: raw,
    score: verdict?.score ?? null,
    fidelity: verdict?.fidelity ?? null,
    rigor: verdict?.rigor ?? null,
    engagement: verdict?.engagement ?? null,
    objection_school: verdict?.unanswered_objection.school ?? null,
    cost_usd: costUsd,
    latency_ms: latencyMs,
    error,
    at: new Date().toISOString(),
  });
}

// Read once. It used to be re-read on every logged call while
// callJudgeModel used its own module-scope cache, so a prompt edited
// mid-run would have been fingerprinted against something other than what
// was sent.
let promptTextCache: string | null = null;

function promptText(): string {
  promptTextCache ??= fs.readFileSync(
    path.join(process.cwd(), "content", "prompts", `judge.${VERSION}.md`),
    "utf-8"
  );
  return promptTextCache;
}

async function sampleCase(
  c: GoldenCase,
  plan: RunnablePlan,
  run: GoldenRun | null
): Promise<{ samples: Sample[]; failures: string[] }> {
  const samples: Sample[] = [];
  const failures: string[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    try {
      const { verdict, costUsd, latencyMs } = await callJudgeModel(
        c.motion,
        c.school,
        c.argument,
        undefined,
        VERSION,
        // undefined for a live school, so it is judged against rubric.ts
        // exactly as production would; the draft file's text for a draft
        // school, which callJudgeModel accepts only for a school with no
        // live criteria.
        plan.draftCriteria
      );

      if (verdict.rejected) {
        await logCall(run, c, plan, i + 1, costUsd, latencyMs, null, verdict, "model rejected the submission");
        failures.push("model rejected the submission");
        continue;
      }
      await logCall(run, c, plan, i + 1, costUsd, latencyMs, verdict, verdict, null);
      samples.push({
        score: verdict.score,
        fidelity: verdict.fidelity,
        rigor: verdict.rigor,
        engagement: verdict.engagement,
        weakestMove: verdict.weakest_move,
        objectionSchool: verdict.unanswered_objection.school,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A billed call still counts even when the response didn't validate.
      if (err instanceof JudgeValidationError) {
        await logCall(run, c, plan, i + 1, err.costUsd, err.latencyMs, null, null, message);
      }
      failures.push(message);
    }
  }

  return { samples, failures };
}

// What one call is expected to cost under the prompt version being run.
//
// Derived, not copied, from src/lib/anthropic.ts: the token estimates in
// its COST comment and its two per-token rates. Two corrections to the
// obvious approach, both found in review:
//
// - est_in=1700 was measured for v2. The whole prompt file is sent, header
//   comment included, and v3 is more than twice v2's size, so a v3 run
//   priced at v2's figure understated it by about a quarter. The difference
//   in file size is added at roughly four bytes a token. That is a rule of
//   thumb rather than a count, which would need an API call.
// - The COST comment's own est_usd_per_call=0.0098 does not follow from
//   its est_in and est_out at those rates, which give 0.0099. The frozen
//   file is left alone and the figure is computed here instead.
function estimatedUsdPerCall(): { usd: number; inputTokens: number; outputTokens: number } {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "lib", "anthropic.ts"), "utf-8");

  // Each figure must match exactly once, anchored to the declaration that
  // holds it, so a second declaration (a SCREEN_INPUT_COST_PER_TOKEN above
  // this one, say) cannot be read in its place. Digit separators allowed,
  // since `1_700` is how this repository writes numbers elsewhere.
  const one = (re: RegExp, what: string): RegExpExecArray => {
    const hits = [...source.matchAll(new RegExp(re.source, "gm"))];
    if (hits.length !== 1) {
      throw new Error(
        `expected exactly one ${what} in src/lib/anthropic.ts, found ${hits.length}`
      );
    }
    return hits[0];
  };
  const int = (s: string) => Number(s.replace(/_/g, ""));

  // The COST comment has to be the one for the model this runner calls.
  const cost = one(
    new RegExp(`^// COST: model=${MODEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} .*est_in=([\\d_]+) est_out=([\\d_]+)`),
    `COST comment for ${MODEL}`
  );
  const estIn = int(cost[1]);
  const estOut = int(cost[2]);
  const inRate = one(/^const INPUT_COST_PER_TOKEN = ([\d_]+) \/ ([\d_]+);/, "INPUT_COST_PER_TOKEN");
  const outRate = one(/^const OUTPUT_COST_PER_TOKEN = ([\d_]+) \/ ([\d_]+);/, "OUTPUT_COST_PER_TOKEN");
  const rate = (m: RegExpExecArray) => int(m[1]) / int(m[2]);

  const bytes = (v: string) =>
    fs.statSync(path.join(process.cwd(), "content", "prompts", `judge.${v}.md`)).size;
  const inputTokens = Math.round(estIn + (bytes(VERSION) - bytes("v2")) / 4);
  return {
    usd: inputTokens * rate(inRate) + estOut * rate(outRate),
    inputTokens,
    outputTokens: estOut,
  };
}

function planSummary(cases: GoldenCase[], plans: Map<string, CasePlan>): string {
  const running = cases.filter((c) => plans.get(c.name)!.run).length;
  const calls = running * SAMPLES;
  const est = estimatedUsdPerCall();
  return (
    `${running} of ${cases.length} case(s) would run: ${calls} call(s), ` +
    `about $${(calls * est.usd).toFixed(2)}, at an estimated ` +
    `$${est.usd.toFixed(4)} a call (~${est.inputTokens} tokens in, ` +
    `~${est.outputTokens} out, priced at src/lib/anthropic.ts's rates). ` +
    `An estimate: the real run reports what was billed.`
  );
}

function printPlan(cases: GoldenCase[], plans: Map<string, CasePlan>): void {
  console.log(`\nPrompt ${VERSION}, ${SAMPLES} sample(s) per case. ${planSummary(cases, plans)}\n`);
}

function dryRun(cases: GoldenCase[], plans: Map<string, CasePlan>): void {
  const rows = cases.map((c) => {
    const plan = plans.get(c.name)!;
    return {
      case: c.name,
      school: c.school,
      criteria: plan.run ? plan.source : "-",
      runs: plan.run ? "yes" : `no: ${plan.reason}`,
    };
  });
  console.log(`\nDry run, prompt ${VERSION}, ${SAMPLES} sample(s) per case. Nothing was sent.\n`);
  console.table(rows);
  console.log(`\n${planSummary(cases, plans)}`);
}

async function main() {
  const cases = loadCases();
  // Every case is planned before the first call, so a fixture naming a
  // school with criteria nowhere throws here, at no cost, rather than
  // three billed cases into the run.
  const draft = readDraftCriteria();
  const plans = new Map(cases.map((c) => [c.name, planCase(c.school, promptText(), draft, VERSION)]));

  // Everything up to here costs nothing: the fixtures are validated, every
  // case is planned, and a broken one has already thrown. A dry run stops
  // here and says what a real run would do and spend, so the bill is seen
  // before it is incurred. It needs no API key, because the client is only
  // built on the first call.
  // Which key a run would use, described and never printed. A dry run
  // reports it so that "is the key visible" can be answered for nothing; a
  // real run refuses to start without one, here, before anything is spent,
  // rather than failing on every call.
  const evalKey = resolveEvalKey(process.env);

  if (DRY_RUN) {
    dryRun(cases, plans);
    console.log(describeEndpoint(process.env));
    console.log(describeEvalKey(evalKey));
    return;
  }
  if (!evalKey.ok) {
    throw new Error(`refusing to start a real run: ${evalKey.reason}`);
  }
  const endpoint = endpointProblem(process.env);
  if (endpoint) {
    throw new Error(`refusing to start a real run: ${endpoint}`);
  }
  // src/lib/anthropic.ts builds its client on the first call, from this
  // variable, so setting it here, in this process only, is all it takes.
  process.env.ANTHROPIC_API_KEY = evalKey.key;

  // A real run says what it is about to spend before it spends it.
  printPlan(cases, plans);
  console.log(describeEvalKey(evalKey));
  const run =
    LOG_TO === "file"
      ? startRun({
          promptVersion: VERSION,
          promptText: promptText(),
          model: MODEL,
          samplesPerCase: SAMPLES,
        })
      : null;
  const rows: {
    name: string;
    score: string;
    scorePass: boolean;
    fidelity: string;
    fidelityPass: boolean;
    rigor: string;
    rigorPass: boolean;
    engagement: string;
    engagementPass: boolean;
    weakestMove: string;
    weakestMovePass: boolean;
    objection: string;
    objectionPass: boolean;
    notes: string[];
  }[] = [];

  let anyFail = false;
  const skipped: string[] = [];

  for (const c of cases) {
    // A draft school runs against the draft file's criteria, under a prompt
    // that can list rival schools. Under v1 or v2 it is skipped, because
    // those prompts count the rivals as two. Not a failure and not silent:
    // the summary names each skipped case and why.
    const plan = plans.get(c.name)!;
    if (!plan.run) {
      skipped.push(`${c.name} (${c.school}): ${plan.reason}`);
      continue;
    }

    const { samples, failures } = await sampleCase(c, plan, run);

    // Fewer than half the samples usable means the case has no measurable
    // result, not a low one — reporting a median of one sample would hide
    // that the other two failed.
    if (samples.length * 2 <= SAMPLES - 1 || samples.length === 0) {
      rows.push({
        name: c.name,
        score: `no result (${c.expected_score_band.join("-")})`,
        scorePass: false,
        fidelity: `- (${bandLabel(c.expected_fidelity_band)})`,
        fidelityPass: false,
        // Not `false`: the case already fails on score and sets anyFail,
        // and printing a cross against a band of "any" contradicts what an
        // absent band means.
        rigor: `- (${bandLabel(c.expected_rigor_band)})`,
        rigorPass: true,
        engagement: `- (${bandLabel(c.expected_engagement_band)})`,
        engagementPass: true,
        weakestMove: "-",
        weakestMovePass: true,
        objection: "-",
        objectionPass: false,
        notes: [`${failures.length}/${SAMPLES} samples failed`, ...new Set(failures)],
      });
      anyFail = true;
      continue;
    }

    const scores = samples.map((s) => s.score);
    const fidelities = samples.map((s) => s.fidelity);
    const rigors = samples.map((s) => s.rigor);
    const engagements = samples.map((s) => s.engagement);
    const scoreMedian = median(scores);
    const fidelityMedian = median(fidelities);
    const rigorMedian = median(rigors);
    const engagementMedian = median(engagements);

    const scorePass = inBand(scoreMedian, c.expected_score_band);
    const fidelityPass = inBand(fidelityMedian, c.expected_fidelity_band);
    const rigorPass = inBand(rigorMedian, c.expected_rigor_band);
    const engagementPass = inBand(engagementMedian, c.expected_engagement_band);

    // An objection drawn from the argued school can't be revised against,
    // so /api/judge drops it and stores the rest of the verdict. That makes
    // a minority occurrence a handled degradation rather than a break —
    // reported below either way, but only failing the run when it is the
    // majority behaviour, which would mean the prompt had genuinely
    // stopped producing rival objections.
    const rivals = samples.filter(
      (s) => s.objectionSchool !== c.school && c.expected_objection_school.includes(s.objectionSchool)
    );
    const objectionPass = rivals.length * 2 > samples.length;
    const objectionSchools = [...new Set(samples.map((s) => s.objectionSchool))].join(", ");

    // Majority rule, as for the objection, and for the same reason: one
    // sample in three missing the point is a reading to report, not a
    // prompt that has stopped working.
    const terms = c.expected_weakest_move_any_of;
    const naming = terms
      ? samples.filter((s) =>
          terms.some((t) => s.weakestMove.toLowerCase().includes(t.toLowerCase()))
        ).length
      : samples.length;
    const weakestMovePass = naming * 2 > samples.length;

    if (
      !scorePass ||
      !fidelityPass ||
      !rigorPass ||
      !engagementPass ||
      !weakestMovePass ||
      !objectionPass
    ) {
      anyFail = true;
    }

    const notes: string[] = [];
    if (failures.length) notes.push(`${failures.length}/${SAMPLES} samples failed`, ...new Set(failures));
    if (!objectionPass) notes.push(`objection from argued school in ${samples.length - rivals.length} sample(s)`);
    if (terms && !weakestMovePass) {
      notes.push(
        `weakest_move named the invention in ${naming} of ${samples.length} sample(s); ` +
          `looked for any of: ${terms.join(", ")}`
      );
    }

    rows.push({
      name: c.name,
      score: `${scoreMedian} [${spread(scores)}] (${c.expected_score_band.join("-")})`,
      scorePass,
      fidelity: `${fidelityMedian} [${spread(fidelities)}] (${bandLabel(c.expected_fidelity_band)})`,
      fidelityPass,
      rigor: `${rigorMedian} [${spread(rigors)}] (${bandLabel(c.expected_rigor_band)})`,
      rigorPass,
      engagement: `${engagementMedian} [${spread(engagements)}] (${bandLabel(
        c.expected_engagement_band
      )})`,
      engagementPass,
      weakestMove: terms ? `${naming}/${samples.length}` : "-",
      weakestMovePass,
      objection: objectionSchools,
      objectionPass,
      notes,
    });
  }

  console.log(
    `\nGolden set — prompt ${VERSION}, ${SAMPLES} sample(s) per case, ` +
      `median reported, [spread] in brackets. A band of "any" is not scored.\n`
  );
  console.table(
    rows.map((r) => ({
      case: r.name,
      "score median [spread] (band)": r.score,
      score_ok: r.scorePass ? "✓" : "✗",
      "fidelity median [spread] (band)": r.fidelity,
      fidelity_ok: r.fidelityPass ? "✓" : "✗",
      "rigor median [spread] (band)": r.rigor,
      rigor_ok: r.rigorPass ? "✓" : "✗",
      "engagement median [spread] (band)": r.engagement,
      eng_ok: r.engagementPass ? "✓" : "✗",
      "weakest_move names it": r.weakestMove,
      wm_ok: r.weakestMove === "-" ? "-" : r.weakestMovePass ? "✓" : "✗",
      objection: r.objection,
      obj_ok: r.objectionPass ? "✓" : "✗",
    }))
  );

  // Outside the table: console.table truncates, and a validation failure's
  // whole value is in knowing which field breached its cap.
  for (const r of rows.filter((row) => row.notes.length)) {
    console.log(`  ${r.name}:`);
    for (const note of r.notes) console.log(`    - ${note}`);
  }

  if (run) {
    const file = flush(run, true);
    console.log(
      `\n${run.calls} call(s), $${run.total_cost_usd.toFixed(4)}, logged to ` +
        `${path.relative(process.cwd(), file)}`
    );
  }

  if (skipped.length) {
    console.log(
      `\n${skipped.length} case(s) skipped under prompt ${VERSION}. ` +
        `These did not run and cost nothing.`
    );
    for (const line of skipped) console.log(`  - ${line}`);
  }

  if (anyFail) {
    console.error("\nOne or more golden cases fell outside its expected band.");
    process.exitCode = 1;
  } else if (skipped.length) {
    console.log("\nEvery case that ran was within its expected bands.");
  } else {
    console.log("\nAll golden cases within their expected bands.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
