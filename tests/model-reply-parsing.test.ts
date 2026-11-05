// The judge's and the screener's parse paths, run on one corpus of model
// replies: which are accepted, what an accepted one parses to, and which
// field a refused one is refused for. Arthur's ruling 13 of 2026-11-05
// moved zod from 3 to 4 on condition that v2's behaviour stays the same;
// these outcomes were taken from zod 3.25.76 and hold unchanged on zod 4
// (docs/decisions.md, "zod 4"), the astral-character cases included, which
// zod 4's own .max() would have let through. The wording of a refusal is zod's and is
// not pinned, except that it never repeats the model's text: the summary
// is logged.
import { describe, expect, it, vi } from "vitest";

let next = "";
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: async () => ({ usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "text", text: next }] }) };
  },
}));

const { callJudgeModel, JudgeValidationError } = await import("../src/lib/anthropic");
const { screenTurn, ScreenError } = await import("../src/lib/screen");

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const valid = {
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
};
const v = (patch: Record<string, unknown>) => ({ ...valid, ...patch });
const o = (patch: Record<string, unknown>) => v({ unanswered_objection: { ...valid.unanswered_objection, ...patch } });
const without = (key: string) => {
  const c: Record<string, unknown> = { ...valid };
  delete c[key];
  return c;
};

const judgeCases: Record<string, unknown> = {
  valid,
  valid_fenced: "```json\n" + JSON.stringify(valid) + "\n```",
  valid_extra_key: v({ extra: "x", notes: { a: 1 } }),
  valid_revision: v({ objection_answered: true, improvement_note: "Answered the ordering objection directly." }),
  valid_zero_scores: v({ score: 0, fidelity: 0, rigor: 0, engagement: 0 }),
  valid_max_scores: v({ score: 100, fidelity: 10, rigor: 10, engagement: 10 }),
  valid_float_scores: v({ score: 71.5, fidelity: 7.25 }),
  valid_caps_exact: v({ strongest_move: words(40), a_stronger_version_would: words(60), verdict_line: words(20) }),
  valid_objection_caps_exact: o({ claim: words(45), why_it_stands: words(35) }),
  valid_whitespace_words: v({ verdict_line: "  " + words(20).split(" ").join("   ") + "  \n" }),
  rejected_ok: { rejected: true, rejection_reason: "Off topic." },
  rejected_with_scores: { rejected: true, rejection_reason: "Off topic.", score: 50 },
  rejected_empty_reason: { rejected: true, rejection_reason: "" },
  rejected_long_reason: { rejected: true, rejection_reason: "x".repeat(201) },
  rejected_reason_200: { rejected: true, rejection_reason: "x".repeat(200) },
  // 200 code points but 201 UTF-16 units: refused, as zod 3 counted.
  rejected_reason_astral_over: { rejected: true, rejection_reason: "x".repeat(199) + "\u{1F600}" },
  rejected_reason_astral_200: { rejected: true, rejection_reason: "x".repeat(198) + "\u{1F600}" },
  // The shapes judge.v2.md asks for: the field the other branch uses, null.
  valid_null_reason: v({ rejection_reason: null }),
  rejected_null_scores: {
    rejected: true,
    rejection_reason: "Off topic.",
    score: null,
    fidelity: null,
    rigor: null,
    engagement: null,
    strongest_move: null,
    weakest_move: null,
    a_stronger_version_would: null,
    verdict_line: null,
    unanswered_objection: null,
  },
  rejected_missing_reason: { rejected: true },
  rejected_string: { rejected: "false", score: 1 },
  rejected_missing: without("rejected"),
  rejected_null: v({ rejected: null }),
  score_over: v({ score: 101 }),
  score_under: v({ score: -1 }),
  score_string: v({ score: "72" }),
  score_null: v({ score: null }),
  score_missing: without("score"),
  fidelity_over: v({ fidelity: 11 }),
  engagement_nan_string: v({ engagement: "NaN" }),
  strongest_over: v({ strongest_move: words(41) }),
  stronger_over: v({ a_stronger_version_would: words(61) }),
  verdict_line_over: v({ verdict_line: words(21) }),
  verdict_line_empty: v({ verdict_line: "" }),
  weakest_empty: v({ weakest_move: "" }),
  weakest_number: v({ weakest_move: 5 }),
  objection_missing: without("unanswered_objection"),
  objection_null: v({ unanswered_objection: null }),
  objection_school_unknown: o({ school: "confucian-hierarchy-school, said the judge" }),
  objection_school_draft: o({ school: "ubuntu" }),
  objection_school_case: o({ school: "Utilitarianism" }),
  objection_claim_over: o({ claim: words(46) }),
  objection_why_over: o({ why_it_stands: words(36) }),
  objection_claim_empty: o({ claim: "" }),
  objection_extra: o({ extra: true }),
  answered_string: v({ objection_answered: "yes" }),
  note_over: v({ improvement_note: words(41) }),
  note_number: v({ improvement_note: 3 }),
  two_faults: v({ score: 200, verdict_line: words(25) }),
  array_root: [valid],
  string_root: "\"just a string\"",
  null_root: "null",
  number_root: "42",
  not_json: "The argument is strong.",
  truncated: JSON.stringify(valid).slice(0, 80),
  empty: "",
};

const screenCases: Record<string, unknown> = {
  ok: { result: "ok", reason: "" },
  ok_no_reason: { result: "ok" },
  ok_extra: { result: "ok", reason: "", extra: 1 },
  harassment: { result: "harassment", reason: "Insults the reader." },
  reason_200: { result: "spam", reason: "x".repeat(200) },
  reason_201: { result: "spam", reason: "x".repeat(201) },
  reason_astral_over: { result: "spam", reason: "x".repeat(199) + "\u{1F600}" },
  reason_astral_200: { result: "spam", reason: "x".repeat(198) + "\u{1F600}" },
  reason_null: { result: "ok", reason: null },
  reason_number: { result: "ok", reason: 3 },
  result_unknown: { result: "rude, said the screener", reason: "" },
  result_missing: { reason: "" },
  result_case: { result: "OK" },
  array_root: [{ result: "ok" }],
  null_root: "null",
  not_json: "ok",
  fenced: "```json\n{\"result\":\"off_topic\",\"reason\":\"About football.\"}\n```",
};

const raw = (c: unknown) => (typeof c === "string" ? c : JSON.stringify(c));

const JUDGE_ACCEPTED: Record<string, unknown> = {
  valid,
  valid_fenced: valid,
  // Keys the schema does not name are dropped, as before.
  valid_extra_key: valid,
  objection_extra: valid,
  valid_null_reason: valid,
  rejected_with_scores: { rejected: true, rejection_reason: "Off topic." },
  rejected_null_scores: { rejected: true, rejection_reason: "Off topic." },
};
for (const k of [
  "valid_revision",
  "valid_zero_scores",
  "valid_max_scores",
  "valid_float_scores",
  "valid_caps_exact",
  "valid_objection_caps_exact",
  "valid_whitespace_words",
  "rejected_ok",
  "rejected_reason_200",
  "rejected_reason_astral_200",
])
  JUDGE_ACCEPTED[k] = judgeCases[k];

const JUDGE_REFUSED: Record<string, string[] | "not json"> = {
  rejected_empty_reason: ["rejection_reason"],
  rejected_long_reason: ["rejection_reason"],
  rejected_reason_astral_over: ["rejection_reason"],
  rejected_missing_reason: ["rejection_reason"],
  rejected_string: ["rejected"],
  rejected_missing: ["rejected"],
  rejected_null: ["rejected"],
  score_over: ["score"],
  score_under: ["score"],
  score_string: ["score"],
  score_null: ["score"],
  score_missing: ["score"],
  fidelity_over: ["fidelity"],
  engagement_nan_string: ["engagement"],
  strongest_over: ["strongest_move"],
  stronger_over: ["a_stronger_version_would"],
  verdict_line_over: ["verdict_line"],
  verdict_line_empty: ["verdict_line"],
  weakest_empty: ["weakest_move"],
  weakest_number: ["weakest_move"],
  objection_missing: ["unanswered_objection"],
  objection_null: ["unanswered_objection"],
  objection_school_unknown: ["unanswered_objection.school"],
  objection_school_draft: ["unanswered_objection.school"],
  objection_school_case: ["unanswered_objection.school"],
  objection_claim_over: ["unanswered_objection.claim"],
  objection_why_over: ["unanswered_objection.why_it_stands"],
  objection_claim_empty: ["unanswered_objection.claim"],
  answered_string: ["objection_answered"],
  note_over: ["improvement_note"],
  note_number: ["improvement_note"],
  two_faults: ["score", "verdict_line"],
  array_root: ["(root)"],
  string_root: ["(root)"],
  null_root: ["(root)"],
  number_root: ["(root)"],
  not_json: "not json",
  truncated: "not json",
  empty: "not json",
};

const SCREEN_ACCEPTED: Record<string, { result: string; reason: string }> = {
  ok: { result: "ok", reason: "" },
  ok_no_reason: { result: "ok", reason: "" },
  ok_extra: { result: "ok", reason: "" },
  harassment: { result: "harassment", reason: "Insults the reader." },
  reason_200: { result: "spam", reason: "x".repeat(200) },
  reason_astral_200: { result: "spam", reason: "x".repeat(198) + "\u{1F600}" },
  fenced: { result: "off_topic", reason: "About football." },
};
const SCREEN_REFUSED: Record<string, string[] | "not json"> = {
  reason_201: ["reason"],
  reason_astral_over: ["reason"],
  reason_null: ["reason"],
  reason_number: ["reason"],
  result_unknown: ["result"],
  result_missing: ["result"],
  result_case: ["result"],
  array_root: ["(root)"],
  null_root: ["(root)"],
  not_json: "not json",
};

const fields = (message: string) => [...new Set(message.split("; ").map((p) => p.split(":")[0].trim()))].sort();

describe("the judge's reply", () => {
  it("covers every case", () => {
    expect(Object.keys({ ...JUDGE_ACCEPTED, ...JUDGE_REFUSED }).sort()).toEqual(Object.keys(judgeCases).sort());
  });

  for (const [name, expected] of Object.entries(JUDGE_ACCEPTED)) {
    it(`accepts ${name}`, async () => {
      next = raw(judgeCases[name]);
      const r = await callJudgeModel("Motion", "stoicism", "An argument.");
      expect(r.verdict).toStrictEqual(expected);
    });
  }

  for (const [name, expected] of Object.entries(JUDGE_REFUSED)) {
    it(`refuses ${name}`, async () => {
      next = raw(judgeCases[name]);
      const err = await callJudgeModel("Motion", "stoicism", "An argument.").then(
        () => null,
        (e: Error) => e
      );
      expect(err).toBeInstanceOf(JudgeValidationError);
      if (expected === "not json") expect(err!.message).toMatch(/^Model response was not valid JSON \(\d+ characters\)$/);
      else expect(fields(err!.message)).toEqual(expected);
    });
  }

  it("never repeats the model's text in a refusal", async () => {
    for (const [name, value] of [
      ["objection_school_unknown", "said the judge"],
      ["objection_school_case", "Utilitarianism"],
    ]) {
      next = raw(judgeCases[name]);
      const err = await callJudgeModel("Motion", "stoicism", "An argument.").catch((e: Error) => e);
      expect((err as Error).message, name).not.toContain(value);
    }
  });
});

describe("the screener's reply", () => {
  it("covers every case", () => {
    expect(Object.keys({ ...SCREEN_ACCEPTED, ...SCREEN_REFUSED }).sort()).toEqual(Object.keys(screenCases).sort());
  });

  for (const [name, expected] of Object.entries(SCREEN_ACCEPTED)) {
    it(`accepts ${name}`, async () => {
      next = raw(screenCases[name]);
      const r = await screenTurn({ quotedClaim: "A claim.", body: "A reply." });
      expect({ result: r.result, reason: r.reason }).toStrictEqual(expected);
    });
  }

  for (const [name, expected] of Object.entries(SCREEN_REFUSED)) {
    it(`refuses ${name}`, async () => {
      next = raw(screenCases[name]);
      const err = await screenTurn({ quotedClaim: "A claim.", body: "A reply." }).then(
        () => null,
        (e: Error) => e
      );
      expect(err).toBeInstanceOf(ScreenError);
      if (expected === "not json") expect(err!.message).toMatch(/^Screen response was not valid JSON: /);
      else expect(fields(err!.message)).toEqual(expected);
    });
  }

  // zod 3 quoted the value it got ("received 'rude, ...'"), and the screener
  // logged it as it came; zod 4 names the options only.
  it("never repeats the model's text in a refusal of its result", async () => {
    for (const [name, value] of [
      ["result_unknown", "said the screener"],
      ["result_case", "OK"],
    ]) {
      next = raw(screenCases[name]);
      const err = await screenTurn({ quotedClaim: "A claim.", body: "A reply." }).catch((e: Error) => e);
      expect((err as Error).message, name).not.toContain(value);
    }
  });
});
