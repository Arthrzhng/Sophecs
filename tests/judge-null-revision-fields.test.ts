// Arthur's ruling of 2026-11-05, under (b): an original's reply that
// carries `objection_answered` and `improvement_note` as null validates,
// and reads as if they were absent. In the v3 run of 22:08 UTC, 31 replies
// did this and were refused, losing two samples.
import { describe, expect, it } from "vitest";
import { VerdictSchema } from "../src/lib/judge/schema";

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
