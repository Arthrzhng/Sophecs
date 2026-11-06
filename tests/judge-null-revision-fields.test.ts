// Arthur's ruling of 2026-11-05, under (b): an original's reply that
// carries `objection_answered` and `improvement_note` as null validates,
// and reads as if they were absent. In the v3 run of 22:08 UTC, 31 replies
// did this and were refused, losing two samples.
//
// "On originals" only. The schema cannot tell an original from a revision,
// so callJudgeModel refuses a revision's null before the schema sees it,
// as it was refused before the ruling: production's v2 revisions keep both
// fields, and the verdict page its "Objection answered." line.
import { describe, expect, it, vi } from "vitest";

let modelReply: unknown;
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => ({
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: "text", text: JSON.stringify(modelReply) }],
      }),
    };
  },
}));

const { VerdictSchema } = await import("../src/lib/judge/schema");
const { callJudgeModel, JudgeValidationError } = await import("../src/lib/anthropic");

const reply = {
  rejected: false,
  score: 64,
  fidelity: 7,
  rigor: 6,
  engagement: 4,
  strongest_move: "It names who carries the cost.",
  weakest_move: "It never says who decides.",
  a_stronger_version_would: "Say who answers when the system is wrong.",
  verdict_line: "A careful argument that stops short of the hard case.",
  unanswered_objection: { school: "virtue-ethics", claim: "Who answers for it?", why_it_stands: "It is never said." },
};

describe("objection_answered and improvement_note", () => {
  it("accepts null for both, and drops them, so nothing stored changes shape", () => {
    const r = VerdictSchema.safeParse({ ...reply, objection_answered: null, improvement_note: null });
    expect(r.success).toBe(true);
    expect(JSON.parse(JSON.stringify(r.data))).toEqual(reply);
  });

  it("reads an original's reply without them as before", () => {
    const r = VerdictSchema.safeParse(reply);
    expect(r.success).toBe(true);
    expect(JSON.parse(JSON.stringify(r.data))).toEqual(reply);
  });

  it("keeps a revision's real values", () => {
    const r = VerdictSchema.safeParse({ ...reply, objection_answered: true, improvement_note: "It now says who decides." });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ objection_answered: true, improvement_note: "It now says who decides." });
  });

  it("still refuses a wrong type, and a note over its cap", () => {
    expect(VerdictSchema.safeParse({ ...reply, objection_answered: "yes" }).success).toBe(false);
    expect(VerdictSchema.safeParse({ ...reply, improvement_note: 3 }).success).toBe(false);
    const long = Array.from({ length: 41 }, () => "word").join(" ");
    expect(VerdictSchema.safeParse({ ...reply, improvement_note: long }).success).toBe(false);
  });
});

describe("a reply's null fields, through callJudgeModel", () => {
  const MOTION = "A motion.";
  const REVISION = { originalArgument: "An earlier attempt.", objectionClaim: "Who answers for it?" };

  it("accepts them on an original, and stores the reply as if they were absent", async () => {
    modelReply = { ...reply, objection_answered: null, improvement_note: null };
    const { verdict } = await callJudgeModel(MOTION, "stoicism", "An argument.");
    expect(JSON.parse(JSON.stringify(verdict))).toEqual(reply);
  });

  for (const field of ["objection_answered", "improvement_note"] as const) {
    it(`refuses ${field}: null on a revision, as before the ruling`, async () => {
      modelReply = { ...reply, objection_answered: true, improvement_note: "It now says who decides.", [field]: null };
      const call = callJudgeModel(MOTION, "stoicism", "An argument.", REVISION);
      await expect(call).rejects.toBeInstanceOf(JudgeValidationError);
      await expect(callJudgeModel(MOTION, "stoicism", "An argument.", REVISION)).rejects.toThrow(
        `${field}: null on a revision`
      );
    });
  }

  it("names both when a revision's reply has both null", async () => {
    modelReply = { ...reply, objection_answered: null, improvement_note: null };
    await expect(callJudgeModel(MOTION, "stoicism", "An argument.", REVISION)).rejects.toThrow(
      "objection_answered: null on a revision; improvement_note: null on a revision"
    );
  });

  it("keeps a revision's real values", async () => {
    modelReply = { ...reply, objection_answered: false, improvement_note: "It now says who decides." };
    const { verdict } = await callJudgeModel(MOTION, "stoicism", "An argument.", REVISION);
    expect(verdict).toMatchObject({ objection_answered: false, improvement_note: "It now says who decides." });
  });

  it("accepts a revision's reply that omits them, as before the ruling", async () => {
    modelReply = reply;
    const { verdict } = await callJudgeModel(MOTION, "stoicism", "An argument.", REVISION);
    expect(JSON.parse(JSON.stringify(verdict))).toEqual(reply);
  });

  it("leaves a rejection on a revision alone, as before the ruling", async () => {
    modelReply = { rejected: true, rejection_reason: "Not an argument.", objection_answered: null };
    const { verdict } = await callJudgeModel(MOTION, "stoicism", "An argument.", REVISION);
    expect(verdict).toEqual({ rejected: true, rejection_reason: "Not an argument." });
  });
});
