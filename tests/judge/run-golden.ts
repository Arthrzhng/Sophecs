// Runs the golden set against the real judge model and prints a table.
// Run before and after any change to the prompt or rubric — paste both
// tables when reporting a change, per the brief.
//
//   npm run judge:golden
//   GOLDEN_SAMPLES=1 npm run judge:golden    (quick, single-sample)
//
// Requires ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY (npm run
// judge:golden loads .env.local via Node's --env-file). This is one of
// exactly two call sites for the Anthropic API in this repo — the other is
// /api/judge.
import fs from "node:fs";
import path from "node:path";
import { callJudgeModel, logAiCall, JudgeValidationError, MODEL, PROMPT_VERSION } from "../../src/lib/anthropic";
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
  expected_fidelity_band: [number, number];
  // The schools whose objection would be a legitimate one to raise against
  // this argument — always the two it was not written from. A set rather
  // than a single value on purpose: either rival is a defensible pick, so
  // pinning one would fail the run on a coin flip.
  expected_objection_school: SchoolId[];
}

interface Sample {
  score: number;
  fidelity: number;
  objectionSchool: SchoolId;
}

function loadCases(): GoldenCase[] {
  const dir = path.join(process.cwd(), "tests", "judge", "golden");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as GoldenCase);
}

function inBand(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
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
  verdict: { score: number; fidelity: number; unanswered_objection: { school: string } } | null,
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
    prompt_version: PROMPT_VERSION,
    request_fingerprint: requestFingerprint({
      promptVersion: PROMPT_VERSION,
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
    path.join(process.cwd(), "content", "prompts", `judge.${PROMPT_VERSION}.md`),
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
      const { verdict, costUsd, latencyMs } = await callJudgeModel(c.motion, c.school, c.argument);

      if (verdict.rejected) {
        await logCall(run, c, i + 1, costUsd, latencyMs, null, verdict, "model rejected the submission");
        failures.push("model rejected the submission");
        continue;
      }
      await logCall(run, c, i + 1, costUsd, latencyMs, verdict, verdict, null);
      samples.push({
        score: verdict.score,
        fidelity: verdict.fidelity,
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
          promptVersion: PROMPT_VERSION,
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
        fidelity: `- (${c.expected_fidelity_band.join("-")})`,
        fidelityPass: false,
        objection: "-",
        objectionPass: false,
        notes: [`${failures.length}/${SAMPLES} samples failed`, ...new Set(failures)],
      });
      anyFail = true;
      continue;
    }

    const scores = samples.map((s) => s.score);
    const fidelities = samples.map((s) => s.fidelity);
    const scoreMedian = median(scores);
    const fidelityMedian = median(fidelities);

    const scorePass = inBand(scoreMedian, c.expected_score_band);
    const fidelityPass = inBand(fidelityMedian, c.expected_fidelity_band);

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

    if (!scorePass || !fidelityPass || !objectionPass) anyFail = true;

    const notes: string[] = [];
    if (failures.length) notes.push(`${failures.length}/${SAMPLES} samples failed`, ...new Set(failures));
    if (!objectionPass) notes.push(`objection from argued school in ${samples.length - rivals.length} sample(s)`);

    rows.push({
      name: c.name,
      score: `${scoreMedian} [${spread(scores)}] (${c.expected_score_band.join("-")})`,
      scorePass,
      fidelity: `${fidelityMedian} [${spread(fidelities)}] (${c.expected_fidelity_band.join("-")})`,
      fidelityPass,
      objection: objectionSchools,
      objectionPass,
      notes,
    });
  }

  console.log(`\nGolden set — ${SAMPLES} sample(s) per case, median reported, [spread] in brackets.\n`);
  console.table(
    rows.map((r) => ({
      case: r.name,
      "score median [spread] (band)": r.score,
      score_ok: r.scorePass ? "✓" : "✗",
      "fidelity median [spread] (band)": r.fidelity,
      fidelity_ok: r.fidelityPass ? "✓" : "✗",
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
