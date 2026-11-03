import { describe, it, expect, vi, beforeEach } from "vitest";

// The retries Arthur ruled on 2026-11-03: a judge reply that fails
// validation is sent again, up to twice, for every prompt version, each
// attempt logged with why it failed, and never truncated to fit. A
// submission that ends without a verdict has its calls taken out of the
// daily cap (the later ruling that day, with migration 0019).
//
// It drives the real judgeDebate and callJudgeModel against a mocked SDK
// that hands back a queue of replies, and a mocked admin client that
// records every ai_calls row, so what is asserted is what production
// would send and log rather than a copy of the retry logic.

const created: Record<string, unknown>[] = [];
const replies: Array<string | Error> = [];
const inserted: Record<string, unknown>[] = [];
const updated: Array<{ table: string; values: Record<string, unknown>; column: string; ids: unknown[] }> = [];

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: async (params: Record<string, unknown>) => {
        created.push(params);
        const next = replies.shift();
        if (next === undefined) throw new Error("test queued no reply for this call");
        if (next instanceof Error) throw next;
        // Distinct token counts per call, so each logged cost can be told
        // apart from the other.
        return {
          usage: { input_tokens: 1000 * created.length, output_tokens: 100 * created.length },
          content: [{ type: "text", text: next }],
        };
      },
    };
  }
  return { default: MockAnthropic };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push({ table, ...row });
        return { error: null };
      },
      update: (values: Record<string, unknown>) => ({
        in: async (column: string, ids: unknown[]) => {
          updated.push({ table, values, column, ids: [...ids] });
          return { error: null };
        },
      }),
    }),
  }),
}));

const { judgeDebate, judgeWithRetries, callJudgeModel, JudgeValidationError, MAX_JUDGE_ATTEMPTS } =
  await import("../src/lib/anthropic");
const { VerdictSchema } = await import("../src/lib/judge/schema");

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i + 1}`).join(" ");

function verdict(verdictLine: string) {
  return {
    rejected: false,
    score: 72,
    fidelity: 8,
    rigor: 7,
    engagement: 5,
    strongest_move: "It locates the agent's responsibility in what is up to her.",
    weakest_move: "It never says why consenting is itself just.",
    a_stronger_version_would: "Say why consenting to stand beside the system is the just choice.",
    verdict_line: verdictLine,
    unanswered_objection: {
      school: "utilitarianism",
      claim: "The patients waiting care about the ordering, not your composure.",
      why_it_stands: "It never weighs what the ordering does to them.",
    },
  };
}

const OVER_CAP = JSON.stringify(verdict(words(21)));
const WITHIN_CAP_LINE = "Answerable for her choice, not the weather.";
const WITHIN_CAP = JSON.stringify(verdict(WITHIN_CAP_LINE));

const PARAMS = {
  motion: "A hospital should be allowed to let an AI triage system order its queue.",
  school: "stoicism" as const,
  argument: "What is up to the clinician is whether she consents, and whether she tells the truth.",
  userId: "00000000-0000-0000-0000-000000000001",
  debateId: "debate-1",
};

beforeEach(() => {
  created.length = 0;
  replies.length = 0;
  inserted.length = 0;
  updated.length = 0;
});

describe("judgeDebate retries a reply that fails validation, up to twice", () => {
  it("allows three calls in all", () => {
    expect(MAX_JUDGE_ATTEMPTS).toBe(3);
  });

  it("still rejects a verdict_line over 20 words: the validator is unchanged", () => {
    const result = VerdictSchema.safeParse(JSON.parse(OVER_CAP));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("verdict_line exceeds 20 words");
  });

  it("sends the same request again and returns the second reply as it came", async () => {
    replies.push(OVER_CAP, WITHIN_CAP);
    const judged = await judgeDebate(PARAMS);

    expect(created).toHaveLength(2);
    // The retry is the same request, byte for byte: nothing is added to
    // tell the model it failed, so the request fixtures still describe
    // every call production makes.
    expect(JSON.stringify(created[1])).toBe(JSON.stringify(created[0]));
    // Never truncated: the verdict is the second reply, untouched.
    expect(judged.verdict).toEqual(JSON.parse(WITHIN_CAP));
    expect(judged.verdict.rejected === false && judged.verdict.verdict_line).toBe(WITHIN_CAP_LINE);
  });

  it("logs both attempts in ai_calls, each with its own cost", async () => {
    replies.push(OVER_CAP, WITHIN_CAP);
    await judgeDebate(PARAMS);

    expect(inserted).toHaveLength(2);
    for (const row of inserted) {
      expect(row).toMatchObject({
        table: "ai_calls",
        kind: "judge",
        user_id: PARAMS.userId,
        debate_id: PARAMS.debateId,
        prompt_version: "v2",
      });
    }
    // 1000 in and 100 out for the first call, 2000 and 200 for the second,
    // at $2 and $10 a million.
    expect(inserted[0].cost_usd).toBeCloseTo(0.003, 10);
    expect(inserted[1].cost_usd).toBeCloseTo(0.006, 10);
  });

  it("writes why a reply failed on its row, and nothing on a reply that validated", async () => {
    replies.push(OVER_CAP, WITHIN_CAP);
    await judgeDebate(PARAMS);

    expect(inserted[0].validation_error).toBe("verdict_line: verdict_line exceeds 20 words");
    expect(inserted[1]).not.toHaveProperty("validation_error");
    // Neither the reply nor the argument reaches the log.
    expect(JSON.stringify(inserted)).not.toContain("word21");
    expect(JSON.stringify(inserted)).not.toContain(PARAMS.argument);
  });

  it("takes a third reply when the first two fail, and leaves every call in the cap", async () => {
    replies.push(OVER_CAP, OVER_CAP, WITHIN_CAP);
    const judged = await judgeDebate(PARAMS);

    expect(created).toHaveLength(3);
    expect(JSON.stringify(created[2])).toBe(JSON.stringify(created[0]));
    expect(inserted).toHaveLength(3);
    expect(judged.verdict).toEqual(JSON.parse(WITHIN_CAP));
    // A submission that ends with a verdict is one of the reader's
    // arguments, so nothing is taken out of the cap.
    expect(updated).toHaveLength(0);
  });

  it("gives up after the third failure, and takes all three calls out of the daily cap", async () => {
    replies.push(OVER_CAP, OVER_CAP, OVER_CAP, WITHIN_CAP);
    const failure = await judgeDebate(PARAMS).catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(JudgeValidationError);
    expect((failure as Error).message).toContain("verdict_line exceeds 20 words");
    expect(created).toHaveLength(3);
    expect(inserted).toHaveLength(3);
    // The fourth reply was queued and never asked for.
    expect(replies).toHaveLength(1);
    // Billed, so still logged; but not one of the reader's arguments.
    expect(updated).toEqual([
      {
        table: "ai_calls",
        values: { counts_toward_cap: false },
        column: "id",
        ids: inserted.map((row) => row.id),
      },
    ]);
  });

  it("retries a reply that is not JSON at all, and logs its length, not its text", async () => {
    replies.push("Here is my verdict: it is good.", WITHIN_CAP);
    const judged = await judgeDebate(PARAMS);
    expect(created).toHaveLength(2);
    expect(inserted).toHaveLength(2);
    expect(judged.verdict).toEqual(JSON.parse(WITHIN_CAP));
    expect(inserted[0].validation_error).toBe("Model response was not valid JSON (31 characters)");
  });

  it("never logs what the judge wrote, even when zod would quote it", async () => {
    const badSchool = verdict(WITHIN_CAP_LINE) as Record<string, unknown>;
    badSchool.unanswered_objection = {
      school: "a school named after the argument's own words",
      claim: "c",
      why_it_stands: "w",
    };
    replies.push(JSON.stringify(badSchool), WITHIN_CAP);
    await judgeDebate(PARAMS);
    expect(inserted[0].validation_error).toMatch(/^unanswered_objection\.school: /);
    expect(String(inserted[0].validation_error)).not.toContain("argument's own words");
  });

  it("makes one call and logs one row when the first reply validates", async () => {
    replies.push(WITHIN_CAP, WITHIN_CAP);
    await judgeDebate(PARAMS);
    expect(created).toHaveLength(1);
    expect(inserted).toHaveLength(1);
    expect(updated).toHaveLength(0);
  });

  it("does not retry a rejection, which is a valid reply", async () => {
    replies.push(JSON.stringify({ rejected: true, rejection_reason: "not an argument" }), WITHIN_CAP);
    const judged = await judgeDebate(PARAMS);
    expect(judged.verdict.rejected).toBe(true);
    expect(created).toHaveLength(1);
    expect(inserted).toHaveLength(1);
  });

  it("does not retry or log an error from the API itself", async () => {
    replies.push(new Error("529 overloaded"), WITHIN_CAP);
    await expect(judgeDebate(PARAMS)).rejects.toThrow("529 overloaded");
    expect(created).toHaveLength(1);
    expect(inserted).toHaveLength(0);
    // Nothing was logged, so nothing needs taking out of the cap.
    expect(updated).toHaveLength(0);
  });

  it("logs the failed first attempt when a retry hits an API error, and takes it out of the cap", async () => {
    replies.push(OVER_CAP, new Error("529 overloaded"));
    await expect(judgeDebate(PARAMS)).rejects.toThrow("529 overloaded");
    expect(created).toHaveLength(2);
    expect(inserted).toHaveLength(1);
    // The submission still ended without a verdict, so the reader is told
    // it did not use one of their arguments, and the one billed call that
    // was logged must not count either.
    expect(updated).toEqual([
      { table: "ai_calls", values: { counts_toward_cap: false }, column: "id", ids: [inserted[0].id] },
    ]);
  });
});

describe("judgeWithRetries under v3, as the golden runner calls it", () => {
  it("retries a v3 reply and reports both attempts, the failure first", async () => {
    replies.push(OVER_CAP, WITHIN_CAP);
    const attempts: Array<{ attempt: number; error: string | null; hasVerdict: boolean }> = [];
    const judged = await judgeWithRetries(
      () => callJudgeModel(PARAMS.motion, PARAMS.school, PARAMS.argument, undefined, "v3"),
      async (a) => {
        attempts.push({ attempt: a.attempt, error: a.error, hasVerdict: a.verdict !== null });
      }
    );

    expect(created).toHaveLength(2);
    // It is a v3 request: only v3 lists the rival schools.
    expect(String(created[0].system)).toContain("- `utilitarianism`");
    expect(JSON.stringify(created[1])).toBe(JSON.stringify(created[0]));
    expect(attempts).toEqual([
      { attempt: 1, error: expect.stringContaining("verdict_line exceeds 20 words"), hasVerdict: false },
      { attempt: 2, error: null, hasVerdict: true },
    ]);
    expect(judged.verdict).toEqual(JSON.parse(WITHIN_CAP));
    // The golden runner logs through the callback, never to ai_calls here.
    expect(inserted).toHaveLength(0);
  });
});
