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

// Scholars and translators the research file names. A passage may name one
// only if the school's own file does.
const SCHOLARS = [
  "Metz", "Menkiti", "Gyekye", "Mhlambi", "Segun", "Matolino", "Kwindingwi", "Shutte", "Louw", "Ramose",
  "Ames", "Rosemont", "Vallor", "Rosenlee", "Legge", "Slingerland", "Lau",
  "Keown", "Goodman", "Hallisey", "Garfield", "Hongladarom", "Hershock", "Harvey", "Sujato", "Müller",
  // Names a passage could reach for at the start of a sentence, where the
  // capitalised-word check below does not look.
  "Mencius", "Xunzi", "Mozi", "Laozi", "Zhuangzi", "Santideva", "Shantideva", "Nagarjuna", "Buddhaghosa",
  "Dogen", "Tutu", "Mbiti", "Wiredu",
];
// Every other word a passage capitalises in mid-sentence: a school or its
// adherent, or a day. Anything else, a name or a text above all, has to be
// one the school's own file names.
const PROPER = new Set([
  "Confucian", "Confucians", "Confucianism", "Ubuntu", "Buddhist", "Buddhists", "Ethicist", "Ethicists", "Ethics",
  "Stoic", "Stoics", "Stoicism", "Utilitarian", "Utilitarians", "Utilitarianism", "Virtue",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]);
// Words any quotation in the research file shares with a passage, five in a
// row, outside the verified wordings above: a quotation used without being
// declared (Legge's 13.3, say).
const words = (t: string) => t.toLowerCase().replace(/[\u2018\u2019']/g, "'").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
const fiveGrams = (t: string) => {
  const w = words(t);
  return new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(" ")));
};
// Line by line, so a stray mark cannot pair one quotation's close with the
// next one's open.
const QUOTED = RESEARCH.split("\n").flatMap((line) => [...line.matchAll(/["\u201C]([^"\u201C\u201D]{20,}?)["\u201D]/g)].map((m) => m[1]));
const QUOTED_GRAMS = new Set(QUOTED.flatMap((q) => [...fiveGrams(q)]));

describe("the launch schools' passages", () => {
  const all = passages();

  it("are all read: six topics, three schools, four positions, four reasons, three examples and two objections of three parts each, and the closings", () => {
    expect(LAUNCH_SCHOOLS).toHaveLength(3);
    // 4 positions, 4 reasons, 3 examples, and 2 objections of 3 parts.
    expect(all.length).toBe(6 * 3 * (4 + 4 + 3 + 2 * 3) + 3 * 4);
  });

  it("use verified wording only as verified, and only with its source named", () => {
    for (const v of VERIFIED) {
      expect(RESEARCH.toLowerCase(), v.wording).toContain(v.wording.toLowerCase());
      // Any five words of it in a row count as using it, not only its end.
      const grams = fiveGrams(v.wording);
      const uses = (t: string) => v.marker.test(t) || [...fiveGrams(t)].some((g) => grams.has(g));
      for (const p of all.filter((x) => uses(x.text))) {
        expect(p.text.toLowerCase(), p.where).toContain(v.wording.toLowerCase());
        for (const c of v.credit) expect(p.text, p.where).toMatch(c);
      }
    }
  });

  it("name only scholars their own school's file names", () => {
    for (const p of all) {
      const own = schoolFile(p.school);
      for (const name of SCHOLARS) if (p.text.includes(name)) expect(own, `${p.where} names ${name}`).toContain(name);
      // Any other capitalised word in mid-sentence is a known proper noun or
      // one the school's file uses.
      for (const m of p.text.matchAll(/(?<![.!?]\s)(?<=\s)([A-Z][\p{L}'\u2019-]+)/gu)) {
        const w = m[1].replace(/['\u2019]s$/, "");
        if (!PROPER.has(w)) expect(own, `${p.where}: "${w}"`).toContain(w);
      }
    }
  });

  it("share no five words in a row with a quotation in the research file, beyond the verified wordings they credit", () => {
    expect(QUOTED.length).toBeGreaterThan(20);
    const allowed = new Set(VERIFIED.flatMap((v) => [...fiveGrams(v.wording)]));
    for (const p of all)
      for (const g of fiveGrams(p.text)) if (QUOTED_GRAMS.has(g) && !allowed.has(g)) expect.fail(`${p.where}: "${g}"`);
  });

  it("put no words in the mouth of Confucius or the Buddha: neither is named, nor \"the Master\"", () => {
    for (const p of all) expect(p.text, p.where).not.toMatch(/\b(Confucius|Buddha|the Master)\b/);
  });

  it("keep the house style: no dashes, no quotation marks, British spelling", () => {
    const american =
      /\b(\w*(?:iz(?:e|es|ed|ing|ation|ations))|behavior\w*|neighbor\w*|honor\w*|favor\w*|labor\w*|center\w*|color\w*|defense|offense|skeptic\w*|modeled|modeling|catalog|gray|fulfill|fulfills|fulfillment|analyz\w*|judgment\w*)\b/gi;
    const allowed = new Set(["size", "sizes", "sized", "seize", "seized", "prize", "prizes", "citizen"]);
    for (const p of all) {
      // Dashes in any form: the dash characters, a minus sign, a spaced
      // hyphen or a doubled one standing in for a dash, and guillemets.
      expect(p.text, p.where).not.toMatch(/[\u2012-\u2015\u2212\u00AB\u00BB]|\s-\s|--/);
      expect(p.text, p.where).not.toMatch(/["“”‘‛]/);
      // An apostrophe only inside or at the end of a word: a possessive.
      for (const m of p.text.matchAll(/['’]/g)) expect(p.text[(m.index ?? 0) - 1] ?? "", p.where).toMatch(/[A-Za-z0-9]/);
      for (const hit of p.text.matchAll(american)) if (!allowed.has(hit[0].toLowerCase())) expect.fail(`${p.where}: ${hit[0]}`);
    }
  });

  it("give every objection a claim that completes \"A X will object that ...\"", () => {
    for (const p of all.filter((x) => x.where.endsWith(".claim"))) {
      expect(p.text[0], p.where).toMatch(/[a-z]/);
      expect(p.text, p.where).toMatch(/\.$/);
    }
  });
});
