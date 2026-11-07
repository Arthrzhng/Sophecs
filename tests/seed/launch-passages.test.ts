import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LAUNCH_SCHOOLS, TOPICS, loadClosings, loadFragments, type SchoolId } from "../../scripts/seed/banks";

/**
 * The launch schools' passages (Arthur, 2026-11-07, Gate 4 item 13), held
 * to what the quotation guard holds content to ("quotation guard
 * applies"). tests/content-quotations.test.ts reads quotation marks in
 * content/**, and these passages, under scripts/, carry none: they use a
 * source's words only as an attributed sentence. So this file checks the
 * same rules on them directly:
 *
 * - verified wording is used only exactly as verified, with its source
 *   named in the same passage (ruling (e)9);
 * - a scholar named in a passage is one the school's own file names;
 * - nothing is put in the mouth of Confucius or the Buddha;
 * - the house style: no dashes, no quotation marks, British spelling;
 * - every objection's claim completes "A X will object that ...".
 */

type Passage = { where: string; school: string; text: string };

function passages(): Passage[] {
  const out: Passage[] = [];
  for (const topic of TOPICS) {
    const fr = loadFragments(topic);
    for (const id of LAUNCH_SCHOOLS) {
      const s = fr.schools[id as unknown as SchoolId];
      const push = (where: string, text: string) => out.push({ where: `${topic}.${id}.${where}`, school: id, text });
      s.positions.forEach((t, i) => push(`positions[${i}]`, t));
      s.reasons.forEach((t, i) => push(`reasons[${i}]`, t));
      s.examples.forEach((t, i) => push(`examples[${i}]`, t));
      s.objections.forEach((o, i) => {
        push(`objections[${i}].claim`, o.claim);
        push(`objections[${i}].answer`, o.answer);
        push(`objections[${i}].why`, o.why);
      });
    }
  }
  const closings = loadClosings();
  for (const id of LAUNCH_SCHOOLS)
    closings[id as unknown as SchoolId].forEach((t, i) => out.push({ where: `closings.${id}[${i}]`, school: id, text: t }));
  return out;
}

const RESEARCH = readFileSync(join(process.cwd(), "content", "research", "non-western-sources.md"), "utf8");
const schoolFile = (id: string) => readFileSync(join(process.cwd(), "content", "schools", `${id}.md`), "utf8");

// Verified wording the passages use, each as the research file gives it,
// with what must be named beside it.
const VERIFIED = [
  {
    marker: /person is a person through/i,
    wording: "a person is a person through other persons",
    credit: [/Nguni maxim/, /Metz/],
  },
  {
    marker: /shared identity and solidarity/i,
    wording: "right action honours capacities for relationships of shared identity and solidarity",
    credit: [/Metz/],
  },
];

// Scholars the research file discusses. A passage may name one only if
// the school's own file does.
const SCHOLARS = [
  "Metz", "Menkiti", "Gyekye", "Mhlambi", "Segun", "Matolino", "Kwindingwi",
  "Ames", "Rosemont", "Vallor", "Rosenlee", "Legge", "Sujato", "Müller",
];

describe("the launch schools' passages", () => {
  const all = passages();

  it("are all read: six topics, three schools, thirteen passages each plus three per objection, and the closings", () => {
    expect(LAUNCH_SCHOOLS).toHaveLength(3);
    // 4 positions, 4 reasons, 3 examples, and 2 objections of 3 parts.
    expect(all.length).toBe(6 * 3 * (4 + 4 + 3 + 2 * 3) + 3 * 4);
  });

  it("use verified wording only as verified, and only with its source named", () => {
    for (const v of VERIFIED) {
      expect(RESEARCH.toLowerCase(), v.wording).toContain(v.wording.toLowerCase());
      for (const p of all.filter((x) => v.marker.test(x.text))) {
        expect(p.text.toLowerCase(), p.where).toContain(v.wording.toLowerCase());
        for (const c of v.credit) expect(p.text, p.where).toMatch(c);
      }
    }
  });

  it("name only scholars their own school's file names", () => {
    for (const p of all)
      for (const name of SCHOLARS)
        if (p.text.includes(name)) expect(schoolFile(p.school), `${p.where} names ${name}`).toContain(name);
  });

  it("put no words in the mouth of Confucius or the Buddha", () => {
    for (const p of all) expect(p.text, p.where).not.toMatch(/\b(Confucius|the Buddha)\s+(said|says|taught|teaches|tells|told)\b/);
  });

  it("keep the house style: no dashes, no quotation marks, British spelling", () => {
    const american = /\b(\w*(?:iz(?:e|es|ed|ing|ation|ations))|behaviou?r(?<!our)|honor\w*|favor\w*|labor\w*|center\w*|color\w*|defense|analyz\w*)\b/i;
    const allowed = new Set(["size", "sizes", "sized", "seize", "seized", "prize", "prizes", "citizen"]);
    for (const p of all) {
      expect(p.text, p.where).not.toMatch(/[‒-―]/);
      expect(p.text, p.where).not.toMatch(/["“”‘‛]/);
      // An apostrophe only inside or at the end of a word: a possessive.
      for (const m of p.text.matchAll(/['’]/g)) expect(p.text[(m.index ?? 0) - 1] ?? "", p.where).toMatch(/[A-Za-z0-9]/);
      const hit = p.text.match(american);
      if (hit && !allowed.has(hit[0].toLowerCase())) expect.fail(`${p.where}: ${hit[0]}`);
    }
  });

  it("give every objection a claim that completes \"A X will object that ...\"", () => {
    for (const p of all.filter((x) => x.where.endsWith(".claim"))) {
      expect(p.text[0], p.where).toMatch(/[a-z]/);
      expect(p.text, p.where).toMatch(/\.$/);
    }
  });
});
