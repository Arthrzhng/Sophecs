import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { JudgeValidationError, type JudgeAttempt, type JudgeCallResult } from "../src/lib/anthropic";
import { attemptFields, takeSample, REJECTED } from "./judge/golden-sample";

// The golden runner's half of Arthur's ruling of 2026-11-03: the retry is
// logged "in the golden-run log" too. tests/judge-retry.test.ts covers
// production's half through judgeDebate; this drives takeSample and
// attemptFields, which are what run-golden.ts calls, and checks the
// runner hands them every attempt.

const VALID: JudgeCallResult = {
  verdict: {
    rejected: false,
    score: 72,
    fidelity: 8,
    rigor: 7,
    engagement: 5,
    strongest_move: "It locates the agent's responsibility in what is up to her.",
    weakest_move: "It never says why consenting is itself just.",
    a_stronger_version_would: "Say why consenting is the just choice.",
    verdict_line: "Answerable for her choice, not the weather.",
    unanswered_objection: {
      school: "utilitarianism",
      claim: "The patients waiting care about the ordering.",
      why_it_stands: "It never weighs what the ordering does to them.",
    },
  },
  costUsd: 0.006,
  latencyMs: 5000,
};

const OVER_CAP = () => new JudgeValidationError("verdict_line: verdict_line exceeds 20 words", 0.003, 4000);

// A call that answers from a queue, counting how often it is asked.
function queued(...replies: Array<JudgeCallResult | Error>) {
  const state = { calls: 0 };
  const call = async (): Promise<JudgeCallResult> => {
    state.calls++;
    const next = replies.shift();
    if (next === undefined) throw new Error("no reply queued");
    if (next instanceof Error) throw next;
    return next;
  };
  return { call, state };
}

function recorder() {
  const attempts: JudgeAttempt[] = [];
  return { attempts, record: async (a: JudgeAttempt) => void attempts.push(a) };
}

describe("takeSample", () => {
  it("retries a reply that failed validation and records both attempts", async () => {
    const { call, state } = queued(OVER_CAP(), VALID);
    const { attempts, record } = recorder();
    const outcome = await takeSample(call, record);

    expect(state.calls).toBe(2);
    expect(attempts.map((a) => a.attempt)).toEqual([1, 2]);
    expect(attempts[0].error).toContain("verdict_line exceeds 20 words");
    expect(attempts[0].costUsd).toBe(0.003);
    expect(attempts[1].error).toBeNull();
    expect(outcome).toMatchObject({ failure: null, retried: true, retryFailed: false });
    expect(outcome.sample?.fidelity).toBe(8);
  });

  it("records two failed attempts and stops", async () => {
    const { call, state } = queued(OVER_CAP(), OVER_CAP(), VALID);
    const { attempts, record } = recorder();
    const outcome = await takeSample(call, record);

    expect(state.calls).toBe(2);
    expect(attempts.map((a) => [a.attempt, a.error !== null])).toEqual([
      [1, true],
      [2, true],
    ]);
    expect(outcome.sample).toBeNull();
    expect(outcome.failure).toContain("verdict_line exceeds 20 words");
    expect(outcome).toMatchObject({ retried: true, retryFailed: true });
  });

  it("does not retry a rejection, and records it once", async () => {
    const rejection: JudgeCallResult = {
      verdict: { rejected: true, rejection_reason: "not an argument" },
      costUsd: 0.002,
      latencyMs: 3000,
    };
    const { call, state } = queued(rejection, VALID);
    const { attempts, record } = recorder();
    const outcome = await takeSample(call, record);

    expect(state.calls).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(outcome).toMatchObject({ sample: null, failure: REJECTED, retried: false });
  });

  it("does not retry or record an error from the API", async () => {
    const { call, state } = queued(new Error("529 overloaded"), VALID);
    const { attempts, record } = recorder();
    const outcome = await takeSample(call, record);

    expect(state.calls).toBe(1);
    expect(attempts).toHaveLength(0);
    expect(outcome).toMatchObject({ sample: null, failure: "529 overloaded", retried: false });
  });
});

describe("attemptFields", () => {
  it("records a failed attempt with its number, cost and error, and no scores", () => {
    const fields = attemptFields({
      attempt: 1,
      costUsd: 0.003,
      latencyMs: 4000,
      verdict: null,
      error: "verdict_line: verdict_line exceeds 20 words",
    });
    expect(fields).toEqual({
      attempt: 1,
      response: null,
      score: null,
      fidelity: null,
      rigor: null,
      engagement: null,
      objection_school: null,
      cost_usd: 0.003,
      latency_ms: 4000,
      error: "verdict_line: verdict_line exceeds 20 words",
    });
  });

  it("records a validated retry as attempt 2, with its scores", () => {
    const fields = attemptFields({ attempt: 2, costUsd: 0.006, latencyMs: 5000, verdict: VALID.verdict, error: null });
    expect(fields).toMatchObject({
      attempt: 2,
      score: 72,
      fidelity: 8,
      rigor: 7,
      engagement: 5,
      objection_school: "utilitarianism",
      error: null,
    });
    expect(fields.response).toEqual(VALID.verdict);
  });

  it("keeps a rejection's reply and says why it scored nothing", () => {
    const verdict = { rejected: true as const, rejection_reason: "not an argument" };
    const fields = attemptFields({ attempt: 1, costUsd: 0.002, latencyMs: 3000, verdict, error: null });
    expect(fields).toMatchObject({ response: verdict, score: null, error: REJECTED });
  });
});

describe("the golden runner", () => {
  const runner = fs.readFileSync(path.join(process.cwd(), "tests", "judge", "run-golden.ts"), "utf-8");

  it("takes each sample through takeSample and logs every attempt it is given", () => {
    // run-golden.ts starts a billed run when imported, so its wiring is
    // read rather than run. Each line here is one a reviewer broke while
    // every other test stayed green.
    expect(runner).toContain("await takeSample(");
    expect(runner).toContain("(attempt) => logCall(run, c, plan, i + 1, attempt)");
    expect(runner).toContain("...attemptFields(attempt),");
    expect(runner).not.toMatch(/\battempt:\s*1\b/);
    expect(runner).not.toContain("judgeWithOneRetry(");
  });
});
