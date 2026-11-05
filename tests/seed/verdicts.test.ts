// Every template verdict the banks can produce goes through the judge's own
// response schema, quotes only what is in its argument, and keeps the
// documented score rule.
import { describe, expect, it } from "vitest";
import { VerdictSchema } from "../../src/lib/judge/schema";
import { loadBanks, compose, SCHOOLS, TOPICS } from "../../scripts/seed/banks";
import {
  templateVerdict,
  templateRevisionVerdict,
  templateRejection,
  compositeScore,
  scoreRuleFor,
  SCORE_RANGE,
  SCORE_RULE_2_FROM,
} from "../../scripts/seed/verdicts";
import { Rng } from "../../scripts/seed/rng";
import { small } from "./fixture";

const banks = loadBanks();
const quotes = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

describe("template verdicts", () => {
  it("validate against VerdictSchema, quote the argument, and keep the score rule, for every bank argument", () => {
    for (const topic of TOPICS)
      for (const school of SCHOOLS)
        for (const arg of banks.arguments[`${topic}.${school}`]) {
          const fr = banks.fragments[topic];
          for (const skill of [0, 0.5, 1]) {
            const v = templateVerdict(fr, arg, arg.parts, skill, new Rng(`${arg.id}/${skill}`));
            const parsed = VerdictSchema.safeParse(v);
            expect(parsed.success, `${arg.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
            const [lo, hi] = SCORE_RANGE[arg.tier];
            expect(v.score).toBeGreaterThanOrEqual(lo);
            expect(v.score).toBeLessThanOrEqual(hi);
            const c = compositeScore(v.fidelity, v.rigor, v.engagement);
            expect(v.score === lo || v.score === hi || Math.abs(v.score - c) <= 2.5).toBe(true);
            const text = norm(compose(fr, banks.closings, school, arg.parts));
            for (const q of [...quotes(v.strongest_move), ...quotes(v.weakest_move)]) expect(text).toContain(norm(q));
            expect(v.unanswered_objection!.school).not.toBe(school);
            expect(v.prompt_version).toBe("sample-template-1");
          }
        }
  });

  it("generated debates' verdicts, revisions included, all validate and quote their own argument", () => {
    const ds = small();
    for (const d of ds.debates.map((x) => x.row)) {
      const parsed = VerdictSchema.safeParse(d.verdict);
      expect(parsed.success, d.id).toBe(true);
      if (d.verdict.rejected) continue;
      const v = d.verdict;
      const text = norm(d.argument);
      for (const q of [...quotes(v.strongest_move), ...quotes(v.weakest_move), ...quotes(v.improvement_note ?? "")]) expect(text).toContain(norm(q));
      if (d.kind === "revision") expect(typeof v.objection_answered).toBe("boolean");
    }
  });

  it("never names the judge as having read anything, outside what it quotes from the argument", () => {
    const ds = small();
    for (const d of ds.debates.map((x) => x.row)) {
      const own = Object.values(d.verdict).filter((v) => typeof v === "string").join(" ").replace(/"[^"]*"/g, "");
      expect(own).not.toMatch(/\bthe judge\b/i);
    }
  });

  it("rejections validate too", () => {
    expect(VerdictSchema.safeParse(templateRejection(new Rng("r"))).success).toBe(true);
  });

  it("a revision that answers raises engagement and is marked answered", () => {
    const fr = banks.fragments["opaque-benefit"];
    const arg = banks.arguments["opaque-benefit.stoicism"].find((a) => a.tier === "mid")!;
    const parent = templateVerdict(fr, arg, arg.parts, 0.5, new Rng("p"));
    const idx = fr.schools.stoicism.objections.findIndex((o) => o.rival === parent.unanswered_objection!.school);
    const parts = { ...arg.parts, objections: [idx] };
    const rev = templateRevisionVerdict(fr, "stoicism", "mid", parent, parts, idx, true, new Rng("r"));
    expect(rev.objection_answered).toBe(true);
    expect(rev.engagement).toBeGreaterThan(parent.engagement);
    expect(VerdictSchema.safeParse(rev).success).toBe(true);
  });
});

describe("template verdicts, score rule 2", () => {
  // Everything but the numbers and the version that names their rule.
  const RULED = ["score", "fidelity", "rigor", "engagement", "prompt_version"];
  const strip = (v: object) => Object.fromEntries(Object.entries(v).filter(([k]) => !RULED.includes(k)));

  it("gives whole-number criteria and a composite near the documented rule, and changes nothing else", () => {
    for (const topic of TOPICS)
      for (const school of SCHOOLS)
        for (const arg of banks.arguments[`${topic}.${school}`]) {
          const fr = banks.fragments[topic];
          for (const skill of [0, 0.5, 1]) {
            const one = templateVerdict(fr, arg, arg.parts, skill, new Rng(`${arg.id}/${skill}`), 1);
            const two = templateVerdict(fr, arg, arg.parts, skill, new Rng(`${arg.id}/${skill}`), 2);
            expect(VerdictSchema.safeParse(two).success, arg.id).toBe(true);
            for (const k of ["fidelity", "rigor", "engagement"] as const) {
              expect(Number.isInteger(two[k]), `${arg.id} ${k}`).toBe(true);
              expect(two[k]).toBeGreaterThanOrEqual(0);
              expect(two[k]).toBeLessThanOrEqual(10);
            }
            // Noise of at most 4, rounding, and a move of at most 2 off a multiple of 5.
            expect(Math.abs(two.score - compositeScore(two.fidelity, two.rigor, two.engagement))).toBeLessThanOrEqual(6.5);
            expect(two.prompt_version).toBe("sample-template-2");
            // Every other field is rule 1's, word for word.
            expect(strip(two)).toEqual(strip(one));
          }
        }
  });

  it("a revision under rule 2 lowers no criterion, raises engagement when answered, and keeps its text", () => {
    const fr = banks.fragments["opaque-benefit"];
    for (const arg of banks.arguments["opaque-benefit.stoicism"]) {
      for (const parentRule of [1, 2] as const) {
        const parent = templateVerdict(fr, arg, arg.parts, 0.5, new Rng(`p/${arg.id}`), parentRule);
        const idx = fr.schools.stoicism.objections.findIndex((o) => o.rival === parent.unanswered_objection!.school);
        const parts = { ...arg.parts, objections: [...arg.parts.objections, idx] };
        for (const answered of [true, false]) {
          const one = templateRevisionVerdict(fr, "stoicism", arg.tier, parent, parts, idx, answered, new Rng(`r/${arg.id}`), 1);
          const rev = templateRevisionVerdict(fr, "stoicism", arg.tier, parent, parts, idx, answered, new Rng(`r/${arg.id}`), 2);
          expect(VerdictSchema.safeParse(rev).success).toBe(true);
          for (const k of ["fidelity", "rigor", "engagement"] as const) {
            expect(Number.isInteger(rev[k])).toBe(true);
            expect(rev[k]).toBeGreaterThanOrEqual(Math.round(parent[k]));
          }
          if (answered) expect(rev.engagement).toBeGreaterThan(parent.engagement);
          expect(rev.engagement).toBeLessThanOrEqual(9);
          expect(rev.prompt_version).toBe("sample-template-2");
          expect(strip(rev)).toEqual(strip(one));
        }
      }
    }
  });

  it("applies from the cutover in a run begun before it, and to every row of a run begun after it", () => {
    const cut = Date.parse(SCORE_RULE_2_FROM);
    const before = Date.parse("2026-11-05T03:27:00.000Z");
    expect(scoreRuleFor(cut - 1, before)).toBe(1);
    expect(scoreRuleFor(cut, before)).toBe(2);
    expect(scoreRuleFor(Date.parse("2026-09-20T00:00:00.000Z"), cut)).toBe(2);
  });
});
