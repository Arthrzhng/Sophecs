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
  /**
   * 1 for a sample's first call, 2 and 3 for the retries a reply that
   * failed validation gets (Arthur's rulings of 2026-11-03: one retry,
   * then two). Records with the same sample are one sample. Run files written before the retry, the
   * 3 Nov v3 run among them, have no such field, and every record in them
   * is a first call.
   */
  attempt: 1 | 2 | 3;
  fixture: string;
  school: SchoolId;
  prompt_version: string;
  /**
   * Where the fidelity criteria came from: `live` is src/lib/judge/rubric.ts,
   * exactly what production sends; `draft` is
   * content/prompts/fidelity-criteria.draft.md, which a golden run reads,
   * and since Gate 3 a SIX_SCHOOLS build. Recorded so a result can never be
   * mistaken for the other kind.
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
  // Present, and true, only on a run made with SIX_SCHOOLS=1, whose
  // requests are a flag-on build's: six rivals, and the three new schools
  // judged through the build's own criteria (Gate 3). Absent otherwise, so
  // a run without the flag is written exactly as before.
  six_schools?: true;
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
 * the motion, school and argument, and, since Gate 3, whether the build
 * is a SIX_SCHOOLS one: there, the rival list a v3 prompt is filled with,
 * in its order. The assembly is pure and is pinned byte for byte by the
 * committed fixtures, so equal inputs mean an equal request. Two runs with
 * the same fingerprint sent the same thing.
 *
 * The list is added only on a SIX_SCHOOLS run, so every fingerprint a run
 * without the flag has written, before Gate 3 or since, is computed
 * exactly as before.
 */
export function requestFingerprint(input: {
  promptVersion: string;
  promptText: string;
  criteria: string;
  motion: string;
  school: string;
  argument: string;
  revisionOf?: { originalArgument: string; objectionClaim: string } | null;
  /** The rival list a SIX_SCHOOLS build sends; only on such a run. */
  rivalSchools?: readonly string[];
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
      ...(input.rivalSchools ? [{ rival_schools: [...input.rivalSchools] }] : []),
    ])
  );
}

export const RUNS_DIR = path.join(process.cwd(), "tests", "judge", "golden-runs");

/**
 * Where a golden run logs, from the value of GOLDEN_LOG.
 *
 * `file` unless asked, in exactly one spelling, for `ai_calls`. A function
 * rather than an inline expression in the runner so the default can be
 * tested by what it returns: a reviewer flipped the inline version so that
 * every golden run wrote to the production ledger, which is a stop-(a)
 * database write, and the source-reading test that was meant to guard it
 * stayed green. Anything that is not exactly "ai_calls" means the file,
 * so a typo can only ever fail safe.
 */
export function logTarget(value: string | undefined): "file" | "ai_calls" {
  return value === "ai_calls" ? "ai_calls" : "file";
}

/**
 * Which build's requests a golden run sends (Gate 3), from SIX_SCHOOLS:
 * true for "1", a flag-on build's; false for "0", empty or unset. The
 * modules read the flag as next.config.ts writes it, "1" or not, so a value
 * that only looks like yes (`true`, `yes`, ` 1`) would quietly run flag-off
 * and bill for it. Anything else refuses, before any call. Here rather than
 * in the runner for the reason `logTarget` is: so it can be tested by what
 * it returns.
 */
export function parseSixSchools(value: string | undefined): boolean {
  if (value === undefined || value === "" || value === "0") return false;
  if (value === "1") return true;
  throw new Error(`SIX_SCHOOLS="${value}" is neither "1" nor "0"; refusing to guess which build's requests to send`);
}

export function startRun(meta: {
  promptVersion: string;
  promptText: string;
  model: string;
  samplesPerCase: number;
  /**
   * A SIX_SCHOOLS run: the file says so twice, in `six_schools` and in a
   * run id ending `-six`, so it cannot be taken for a flag-off run of the
   * same version. Absent otherwise, so a flag-off file is written as before.
   */
  sixSchools?: boolean;
}): GoldenRun {
  const started = new Date().toISOString();
  return {
    run_id: `${started.replace(/[:.]/g, "-")}-${meta.promptVersion}${meta.sixSchools ? "-six" : ""}`,
    started_at: started,
    finished_at: null,
    prompt_version: meta.promptVersion,
    prompt_sha256: sha(meta.promptText),
    model: meta.model,
    samples_per_case: meta.samplesPerCase,
    ...(meta.sixSchools ? { six_schools: true as const } : {}),
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

/** Writes the run and returns where it went. `dir` exists so a test can
 *  write somewhere other than the repository. */
export function flush(run: GoldenRun, finished = false, dir: string = RUNS_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  if (finished) run.finished_at = new Date().toISOString();
  const file = path.join(dir, `${run.run_id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
  return file;
}

/**
 * Record one call and write the run to disk at once.
 *
 * The runner calls this rather than `record` and `flush` separately, so
 * that "written after every call" is a property of one function that a
 * test can exercise, instead of a line in the runner that a test can only
 * read. A run that dies part way through leaves everything it spent.
 */
export function recordCall(run: GoldenRun, r: GoldenCallRecord, dir: string = RUNS_DIR): string {
  record(run, r);
  return flush(run, false, dir);
}
