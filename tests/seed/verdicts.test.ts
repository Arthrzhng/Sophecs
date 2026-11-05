// Every template verdict the banks can produce goes through the judge's own
// response schema, quotes only what is in its argument, and keeps the
// documented score rule.
import { describe, expect, it } from "vitest";
import { VerdictSchema } from "../../src/lib/judge/schema";
import { loadBanks, compose, SCHOOLS, TOPICS } from "../../scripts/seed/banks";
import { templateVerdict, templateRevisionVerdict, templateRejection, compositeScore, SCORE_RANGE } from "../../scripts/seed/verdicts";
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
