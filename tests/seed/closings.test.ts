// Each motion's own closings (Arthur, 2026-11-08): "Closing lines must fit
// their motion and not repeat stock phrases across arguments ... Write
// closings per motion ... for all six schools' banks, so exemplar pages
// never show the same ending twice." Four for each school on each motion,
// in scripts/seed/arguments/fragments/closings-by-motion.json, read by a
// run made with quiz v2 and by the banks. Whether a closing fits its motion
// is read, not tested; what can be tested is below. The launch three's are
// also held to the quotation guard's rules in launch-passages.test.ts.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { BANK_SCHOOLS, TOPICS, loadClosings, loadFragments, loadMotionClosings, wordCount } from "../../scripts/seed/banks";

const byMotion = loadMotionClosings();
const all = TOPICS.flatMap((topic) =>
  BANK_SCHOOLS.flatMap((school) => (byMotion[topic]?.[school] ?? []).map((text, i) => ({ where: `${topic}.${school}[${i}]`, text })))
);
const words = (text: string) => text.toLowerCase().match(/[a-z']+/g) ?? [];

describe("each motion's closings", () => {
  it("give every school four on every motion, and nothing else", () => {
    expect(Object.keys(byMotion).sort()).toEqual([...TOPICS].sort());
    for (const topic of TOPICS) {
      expect(Object.keys(byMotion[topic]).sort(), topic).toEqual([...BANK_SCHOOLS].sort());
      for (const school of BANK_SCHOOLS) expect(byMotion[topic][school], `${topic}.${school}`).toHaveLength(4);
    }
    expect(all).toHaveLength(TOPICS.length * BANK_SCHOOLS.length * 4);
  });

  it("are each one sentence of 10 to 30 words, ending in a full stop", () => {
    for (const c of all) {
      expect(c.text.trim(), c.where).toBe(c.text);
      expect(c.text.split(/(?<=[.!?])\s+/), c.where).toHaveLength(1);
      expect(c.text, c.where).toMatch(/\.$/);
      expect(wordCount(c.text), c.where).toBeGreaterThanOrEqual(10);
      expect(wordCount(c.text), c.where).toBeLessThanOrEqual(30);
    }
  });

  it("repeat no closing, here or from the closings every motion shares", () => {
    const shared = new Set(Object.values(loadClosings()).flat());
    expect(new Set(all.map((c) => c.text)).size).toBe(all.length);
    for (const c of all) expect(shared.has(c.text), c.where).toBe(false);
  });

  it("share no stock phrase: no five words in a row, and no first three words, in any two of them", () => {
    const fives = new Map<string, string>();
    const openings = new Map<string, string>();
    for (const c of all) {
      const w = words(c.text);
      for (const gram of new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(" ")))) {
        if (fives.has(gram)) expect.fail(`"${gram}" is in ${fives.get(gram)} and ${c.where}`);
        fives.set(gram, c.where);
      }
      const opening = w.slice(0, 3).join(" ");
      if (openings.has(opening)) expect.fail(`both ${openings.get(opening)} and ${c.where} open "${opening}"`);
      openings.set(opening, c.where);
    }
  });

  it("add a thought of their own: none shares five words in a row with its school's passages on its motion, the motion's words aside", () => {
    // A closing that restates a position or a reason ends the argument by
    // saying it again (the review of these closings, 2026-11-08).
    const fives = (text: string) => {
      const w = words(text);
      return new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(" ")));
    };
    for (const topic of TOPICS) {
      const fr = loadFragments(topic);
      const motion = fives(String(matter(readFileSync(join(process.cwd(), "content", "topics", `${topic}.md`), "utf8")).data.motion));
      for (const school of BANK_SCHOOLS) {
        const s = fr.schools[school];
        const passages = [...s.positions, ...s.reasons, ...s.examples, ...s.objections.flatMap((o) => [o.claim, o.answer, o.why]), ...fr.weak];
        const theirs = new Set(passages.flatMap((p) => [...fives(p)]));
        byMotion[topic][school].forEach((c, i) => {
          for (const gram of fives(c)) if (theirs.has(gram) && !motion.has(gram)) expect.fail(`${topic}.${school}[${i}] repeats "${gram}"`);
        });
      }
    }
  });

  it("keep the house style: no dashes, no quotation marks, British spelling", () => {
    const american =
      /\b(\w*(?:iz(?:e|es|ed|ing|ation|ations))|behavior\w*|neighbor\w*|honor\w*|favor\w*|labor\w*|center\w*|color\w*|defense|offense|skeptic\w*|modeled|modeling|catalog|gray|fulfill|fulfills|fulfillment|analyz\w*|judgment\w*|program|programs)\b/gi;
    const allowed = new Set(["size", "sizes", "sized", "seize", "seized", "prize", "prizes", "citizen"]);
    for (const c of all) {
      expect(c.text, c.where).not.toMatch(/[‒-―−«»]|\s-\s|--/);
      expect(c.text, c.where).not.toMatch(/["“”‘‛]/);
      for (const m of c.text.matchAll(/['’]/g)) expect(c.text[(m.index ?? 0) - 1] ?? "", c.where).toMatch(/[A-Za-z0-9]/);
      for (const hit of c.text.matchAll(american)) if (!allowed.has(hit[0].toLowerCase())) expect.fail(`${c.where}: ${hit[0]}`);
    }
  });
});
