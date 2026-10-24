// Runs the golden set against the real judge model and prints a table.
// Run before and after any change to the prompt or rubric — paste both
// tables when reporting a change, per the brief.
//
//   npm run judge:golden
//   GOLDEN_SAMPLES=1 npm run judge:golden         (quick, single-sample)
//   JUDGE_PROMPT_VERSION=v3 npm run judge:golden  (run a draft prompt)
//
// Requires ANTHROPIC_API_KEY in the environment. It is read from the
// environment and nowhere else: the script no longer loads .env.local via
// Node's --env-file, because an eval box holds the key as an environment
// secret and a file that is not there made the command fail before it
// could say what was missing. SUPABASE_SERVICE_ROLE_KEY is only needed
// under GOLDEN_LOG=ai_calls. This is one of exactly two call sites for the
// Anthropic API in this repo — the other is /api/judge.
import fs from "node:fs";
import path from "node:path";
import {
  callJudgeModel,
  logAiCall,
  JudgeValidationError,
  MODEL,
  PROMPT_VERSION,
  type RunnablePromptVersion,
} from "../../src/lib/anthropic";
import { FIDELITY_CRITERIA } from "../../src/lib/judge/rubric";
import { flush, record, requestFingerprint, startRun, type GoldenRun } from "./golden-log";
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
const LOG_TO = process.env.GOLDEN_LOG === "ai_calls" ? "ai_calls" : "file";

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
// measure the distribution instead of pretending it's a point value, at 3x
// the cost (~18p a run). See docs/decisions.md.
const SAMPLES = Math.max(1, Number(process.env.GOLDEN_SAMPLES ?? "3"));

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
  objectionSchool: SchoolId;
}

function loadCases(): GoldenCase[] {
  const dir = path.join(process.cwd(), "tests", "judge", "golden");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as GoldenCase);
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

async function logCall(
  run: GoldenRun | null,
  c: GoldenCase,
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
  if (!run) return;
  record(run, {
    sample,
    fixture: c.name,
    school: c.school,
    prompt_version: VERSION,
    request_fingerprint: requestFingerprint({
      promptVersion: VERSION,
      promptText: promptText(),
      criteria: FIDELITY_CRITERIA[c.school],
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
  // Written after every call, so a run that dies part way through still
  // leaves a record of what it spent.
  flush(run);
}

function promptText(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "content", "prompts", `judge.${VERSION}.md`),
    "utf-8"
  );
}

async function sampleCase(
  c: GoldenCase,
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
        VERSION
      );

      if (verdict.rejected) {
        await logCall(run, c, i + 1, costUsd, latencyMs, null, verdict, "model rejected the submission");
        failures.push("model rejected the submission");
        continue;
      }
      await logCall(run, c, i + 1, costUsd, latencyMs, verdict, verdict, null);
      samples.push({
        score: verdict.score,
        fidelity: verdict.fidelity,
        rigor: verdict.rigor,
        engagement: verdict.engagement,
        objectionSchool: verdict.unanswered_objection.school,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A billed call still counts even when the response didn't validate.
      if (err instanceof JudgeValidationError) {
        await logCall(run, c, i + 1, err.costUsd, err.latencyMs, null, null, message);
      }
      failures.push(message);
    }
  }

  return { samples, failures };
}

async function main() {
  const cases = loadCases();
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
    objection: string;
    objectionPass: boolean;
    notes: string[];
  }[] = [];

  let anyFail = false;

  for (const c of cases) {
    const { samples, failures } = await sampleCase(c, run);

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
        rigor: `- (${bandLabel(c.expected_rigor_band)})`,
        rigorPass: false,
        engagement: `- (${bandLabel(c.expected_engagement_band)})`,
        engagementPass: false,
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

    if (!scorePass || !fidelityPass || !rigorPass || !engagementPass || !objectionPass) {
      anyFail = true;
    }

    const notes: string[] = [];
    if (failures.length) notes.push(`${failures.length}/${SAMPLES} samples failed`, ...new Set(failures));
    if (!objectionPass) notes.push(`objection from argued school in ${samples.length - rivals.length} sample(s)`);

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

  if (anyFail) {
    console.error("\nOne or more golden cases fell outside its expected band.");
    process.exitCode = 1;
  } else {
    console.log("\nAll golden cases within their expected bands.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
