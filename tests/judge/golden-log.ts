import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SchoolId } from "../../src/lib/types";

/**
 * Where a golden run writes what it did.
 *
 * The Phase 2 rule is that every Anthropic call is logged to `ai_calls`,
 * no exceptions, including in tests. Arthur amended it for the golden set
 * specifically: an eval run logs to a file in the repository instead. Two
 * reasons, and both are about the eval rather than about production.
 * `ai_calls` is production's spend ledger and a judge run is not
 * production spend; and logging there made the run depend on a route to
 * Supabase, which an eval box need not have.
 *
 * **Production logging is untouched.** `judgeDebate` in
 * `src/lib/anthropic.ts` still calls `logAiCall` on success and on a
 * validation failure, `/api/judge` still goes through it, and nothing in
 * `src/` imports this file. `tests/golden-log.test.ts` asserts all of
 * that.
 *
 * The file is richer than the `ai_calls` row it replaces: that row holds
 * cost, latency and a kind, and this holds the response and enough to say
 * which request produced it.
 */

export interface GoldenCallRecord {
  /** 1-based, within the samples taken for this fixture. */
  sample: number;
  fixture: string;
  school: SchoolId;
  prompt_version: string;
  /**
   * Where the fidelity criteria came from: `live` is src/lib/judge/rubric.ts,
   * exactly what production sends; `draft` is
   * content/prompts/fidelity-criteria.draft.md, which only a golden run
   * reads. Recorded so a result can never be mistaken for the other kind.
   */
  criteria_source: "live" | "draft";
  /** See `requestFingerprint`. Not a hash of the literal request bytes. */
  request_fingerprint: string;
  model: string;
  /** The parsed verdict, or null where the response did not validate. */
  response: unknown;
  score: number | null;
  fidelity: number | null;
  rigor: number | null;
  engagement: number | null;
  objection_school: string | null;
  cost_usd: number;
  latency_ms: number;
  error: string | null;
  at: string;
}

export interface GoldenRun {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  prompt_version: string;
  prompt_sha256: string;
  model: string;
  samples_per_case: number;
  calls: number;
  total_cost_usd: number;
  records: GoldenCallRecord[];
}

const sha = (s: string) => crypto.createHash("sha256").update(s, "utf-8").digest("hex");

export function sha256(text: string): string {
  return sha(text);
}

/**
 * A fingerprint of everything that determines the request.
 *
 * Not a hash of the bytes sent. `callJudgeModel` does not hand the caller
 * the request it built, and rebuilding it here to hash it would be a
 * second copy of the assembly, which is the thing
 * `tests/judge-request.test.ts` exists to avoid.
 *
 * What it covers instead is every input the assembly is a function of: the
 * prompt version, the prompt file itself, the school's fidelity criteria,
 * and the motion, school and argument. The assembly is pure and is pinned
 * byte for byte by the committed fixtures, so equal inputs mean an equal
 * request. Two runs with the same fingerprint sent the same thing.
 */
export function requestFingerprint(input: {
  promptVersion: string;
  promptText: string;
  criteria: string;
  motion: string;
  school: string;
  argument: string;
  revisionOf?: { originalArgument: string; objectionClaim: string } | null;
}): string {
  return sha(
    JSON.stringify([
      input.promptVersion,
      sha(input.promptText),
      sha(input.criteria),
      input.motion,
      input.school,
      input.argument,
      input.revisionOf ?? null,
    ])
  );
}

export const RUNS_DIR = path.join(process.cwd(), "tests", "judge", "golden-runs");

export function startRun(meta: {
  promptVersion: string;
  promptText: string;
  model: string;
  samplesPerCase: number;
}): GoldenRun {
  const started = new Date().toISOString();
  return {
    run_id: `${started.replace(/[:.]/g, "-")}-${meta.promptVersion}`,
    started_at: started,
    finished_at: null,
    prompt_version: meta.promptVersion,
    prompt_sha256: sha(meta.promptText),
    model: meta.model,
    samples_per_case: meta.samplesPerCase,
    calls: 0,
    total_cost_usd: 0,
    records: [],
  };
}

export function record(run: GoldenRun, r: GoldenCallRecord): void {
  run.records.push(r);
  run.calls += 1;
  run.total_cost_usd = Number((run.total_cost_usd + r.cost_usd).toFixed(6));
}

/** Writes the run and returns where it went. Written after every call, so
 *  a run that dies part way through still leaves what it had. */
export function flush(run: GoldenRun, finished = false): string {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  if (finished) run.finished_at = new Date().toISOString();
  const file = path.join(RUNS_DIR, `${run.run_id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
  return file;
}
