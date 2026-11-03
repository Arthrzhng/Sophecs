// One golden-run sample: a judge call with production's one retry, and
// what the run file records for each attempt. Kept out of run-golden.ts,
// which runs a whole golden set the moment it is imported, so that
// tests/golden-sample.test.ts can drive exactly what the runner uses.
import {
  judgeWithOneRetry,
  type JudgeAttempt,
  type JudgeCallResult,
} from "../../src/lib/anthropic";
import type { SchoolId } from "../../src/lib/types";
import { recordCall, RUNS_DIR, type GoldenCallRecord, type GoldenRun } from "./golden-log";

export interface Sample {
  score: number;
  fidelity: number;
  rigor: number;
  engagement: number;
  weakestMove: string;
  objectionSchool: SchoolId;
}

export interface SampleOutcome {
  /** The scored verdict, or null when the sample produced none. */
  sample: Sample | null;
  /** Why there is no sample; null when there is one. */
  failure: string | null;
  /** Whether the first reply failed validation and was sent again. */
  retried: boolean;
  /** Whether that second reply failed validation too. */
  retryFailed: boolean;
}

export const REJECTED = "model rejected the submission";

/**
 * Take one sample the way production judges a submission: a reply that
 * fails validation is sent again once (Arthur's ruling of 2026-11-03).
 * Every attempt goes to `record` as it happens, the failed one included,
 * so the run file holds every billed call and its cost adds up.
 *
 * An error from the API itself is not retried and records nothing, as in
 * production; it comes back as the sample's failure.
 */
export async function takeSample(
  call: () => Promise<JudgeCallResult>,
  record: (attempt: JudgeAttempt) => Promise<void>
): Promise<SampleOutcome> {
  // Set from the first attempt, so a retry that ends in an API error,
  // which reaches no logger, still counts as a retry, and as a failed one.
  let retried = false;
  let retryFailed = false;
  let secondReturned = false;
  try {
    const { verdict } = await judgeWithOneRetry(call, async (attempt) => {
      if (attempt.attempt === 1) retried = attempt.error !== null;
      else {
        secondReturned = true;
        retryFailed = attempt.error !== null;
      }
      await record(attempt);
    });
    if (verdict.rejected) return { sample: null, failure: REJECTED, retried, retryFailed };
    return {
      sample: {
        score: verdict.score,
        fidelity: verdict.fidelity,
        rigor: verdict.rigor,
        engagement: verdict.engagement,
        weakestMove: verdict.weakest_move,
        objectionSchool: verdict.unanswered_objection.school,
      },
      failure: null,
      retried,
      retryFailed,
    };
  } catch (err) {
    return {
      sample: null,
      failure: err instanceof Error ? err.message : String(err),
      retried,
      retryFailed: retryFailed || (retried && !secondReturned),
    };
  }
}

/** What a run file records about the case and request, the same for every attempt. */
export type RecordContext = Pick<
  GoldenCallRecord,
  "fixture" | "school" | "prompt_version" | "criteria_source" | "request_fingerprint" | "model"
>;

/**
 * Write one attempt to the run file, whatever its outcome. The runner
 * calls this for every attempt `takeSample` hands it, so a retried sample
 * leaves two records with the same `sample`, attempts 1 and 2.
 */
export function recordAttempt(
  run: GoldenRun,
  context: RecordContext,
  sample: number,
  attempt: JudgeAttempt,
  dir: string = RUNS_DIR
): string {
  return recordCall(
    run,
    { sample, ...context, ...attemptFields(attempt), at: new Date().toISOString() },
    dir
  );
}

/**
 * The fields of a run-file record that come from the attempt itself. A
 * rejection validates, so it is never retried, but it is no score: the
 * record keeps the reply as `response` and says why it scored nothing.
 */
export function attemptFields(
  attempt: JudgeAttempt
): Pick<
  GoldenCallRecord,
  | "attempt"
  | "response"
  | "score"
  | "fidelity"
  | "rigor"
  | "engagement"
  | "objection_school"
  | "cost_usd"
  | "latency_ms"
  | "error"
> {
  const raw = attempt.verdict;
  const verdict = raw && !raw.rejected ? raw : null;
  return {
    attempt: attempt.attempt,
    response: raw,
    score: verdict?.score ?? null,
    fidelity: verdict?.fidelity ?? null,
    rigor: verdict?.rigor ?? null,
    engagement: verdict?.engagement ?? null,
    objection_school: verdict?.unanswered_objection.school ?? null,
    cost_usd: attempt.costUsd,
    latency_ms: attempt.latencyMs,
    error: raw?.rejected ? REJECTED : attempt.error,
  };
}
