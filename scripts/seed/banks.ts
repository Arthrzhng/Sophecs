// The argument banks: scripts/seed/arguments/<topic>.<school>.json, forty
// arguments each, composed from the hand-written passages in
// arguments/fragments/<topic>.json and arguments/fragments/closings.json.
//
// The passages are the reviewable source; the banks are built from them by
// `npm run seed:banks` and committed, and tests/seed/banks.test.ts fails if
// a committed bank differs from a rebuild. An argument keeps the indices of
// the passages it was built from, so the generator can vary it in
// controlled ways (another example, another closing, the reasons the
// other way round) and the template verdict can quote what is actually in
// it.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Rng } from "./rng";
import { QUIZ_SCHOOLS, schoolAdherent, type QuizSchoolId } from "../../src/lib/school-registry";

export const SEED_DIR = join(process.cwd(), "scripts", "seed");
export const ARGUMENT_DIR = join(SEED_DIR, "arguments");

// The schools the quiz sorts into, from the registry: a sample account
// can only hold a school a reader could be placed in.
export const SCHOOLS = QUIZ_SCHOOLS;
export type SchoolId = QuizSchoolId;
export const TOPICS = [
  "opaque-benefit",
  "crash-arithmetic",
  "no-decision",
  "moral-training",
  "careful-builder",
  "borrowed-judgement",
] as const;
export type TopicSlug = (typeof TOPICS)[number];
export type Tier = "strong" | "mid" | "weak";
type Direction = "for" | "against" | "neutral";

export const MIN_WORDS = 80;
export const MAX_WORDS = 250;
export const BANK_SIZE = { strong: 10, mid: 20, weak: 10 } as const;

export interface Objection {
  rival: SchoolId;
  claim: string;
  answer: string;
  why: string;
}

export interface SchoolFragments {
  direction: Direction;
  positions: string[];
  reasons: string[];
  examples: string[];
  objections: Objection[];
}

export interface TopicFragments {
  topic: TopicSlug;
  weak: string[];
  weak_direction: Direction[];
  schools: Record<SchoolId, SchoolFragments>;
}

export type Closings = Record<SchoolId, string[]>;

/** Which passages an argument is made of. Indices into the fragments. */
export interface Parts {
  position: number;
  reasons: number[];
  example: number | null;
  objections: number[];
  closing: number | null;
  weak: number[];
  /** An opening sentence some writers put before their position. Generator variation only. */
  frame?: number;
}

// How some people open: a sentence before the position. Added by the
// generator's variation, never part of a bank argument itself.
export const FRAMES = [
  "Here is my answer.",
  "My position is simple.",
  "I will start with where I stand.",
  "Short version first.",
  "This is how I see it.",
  "Let me say where I land.",
];

export interface BankArgument {
  id: string;
  topic: TopicSlug;
  school: SchoolId;
  tier: Tier;
  parts: Parts;
  text: string;
  words: number;
}

/** "A Stoic", as the class page names a member with no display name. */
export function rivalIntro(school: SchoolId): string {
  return `A ${schoolAdherent(school)}`;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function loadFragments(topic: TopicSlug): TopicFragments {
  return JSON.parse(readFileSync(join(ARGUMENT_DIR, "fragments", `${topic}.json`), "utf8"));
}

export function loadClosings(): Closings {
  return JSON.parse(readFileSync(join(ARGUMENT_DIR, "fragments", "closings.json"), "utf8"));
}

export function objectionSentence(o: Objection): string {
  return `${rivalIntro(o.rival)} will object that ${o.claim} ${o.answer}`;
}

/** The text of an argument made of `parts`, in paragraphs. */
export function compose(
  fr: TopicFragments,
  closings: Closings,
  school: SchoolId,
  parts: Parts
): string {
  const s = fr.schools[school];
  const paragraphs: string[] = [];
  const first = [
    ...(parts.frame !== undefined ? [FRAMES[parts.frame]] : []),
    s.positions[parts.position],
    ...(parts.reasons.length ? [s.reasons[parts.reasons[0]]] : []),
  ];
  paragraphs.push(first.join(" "));
  const second: string[] = [];
  for (const r of parts.reasons.slice(1)) second.push(s.reasons[r]);
  for (const w of parts.weak) second.push(fr.weak[w]);
  if (parts.example !== null) second.push(s.examples[parts.example]);
  if (second.length) paragraphs.push(second.join(" "));
  const third: string[] = parts.objections.map((o) => objectionSentence(s.objections[o]));
  if (parts.closing !== null) {
    if (third.length) third[third.length - 1] += ` ${closings[school][parts.closing]}`;
    else if (paragraphs.length > 1) paragraphs[paragraphs.length - 1] += ` ${closings[school][parts.closing]}`;
    else third.push(closings[school][parts.closing]);
  }
  paragraphs.push(...third);
  return paragraphs.join("\n\n");
}

/**
 * Drops passages, least load-bearing first, until the text fits: the
 * example, then the closing, then a second reason. Used for revisions,
 * which add an objection to an argument that may already be long.
 */
export function fit(fr: TopicFragments, closings: Closings, school: SchoolId, parts: Parts): Parts {
  const p: Parts = { ...parts, reasons: [...parts.reasons], objections: [...parts.objections], weak: [...parts.weak] };
  const over = () => wordCount(compose(fr, closings, school, p)) > MAX_WORDS;
  if (over() && p.example !== null) p.example = null;
  if (over() && p.closing !== null) p.closing = null;
  if (over() && p.weak.length > 1) p.weak = p.weak.slice(0, 1);
  if (over() && p.reasons.length > 1) p.reasons = p.reasons.slice(0, 1);
  return p;
}

function eligibleWeak(fr: TopicFragments, school: SchoolId): number[] {
  const dir = fr.schools[school].direction;
  return fr.weak_direction
    .map((d, i) => [d, i] as const)
    .filter(([d]) => dir === "neutral" || d === dir || d === "neutral")
    .map(([, i]) => i);
}

export function candidates(fr: TopicFragments, school: SchoolId, tier: Tier, closingCount: number): Parts[] {
  const s = fr.schools[school];
  const out: Parts[] = [];
  const P = s.positions.length,
    R = s.reasons.length,
    E = s.examples.length,
    O = s.objections.length;
  if (tier === "strong") {
    for (let p = 0; p < P; p++)
      for (let r0 = 0; r0 < R; r0++)
        for (let r1 = 0; r1 < R; r1++) {
          if (r0 === r1) continue;
          for (let e = 0; e < E; e++)
            for (let o = 0; o < O; o++)
              for (let c = 0; c < closingCount; c++)
                out.push({ position: p, reasons: [r0, r1], example: e, objections: [o], closing: c, weak: [] });
        }
  } else if (tier === "mid") {
    for (let p = 0; p < P; p++)
      for (let r = 0; r < R; r++)
        for (let e = 0; e < E; e++)
          for (let c = 0; c < closingCount; c++)
            out.push({ position: p, reasons: [r], example: e, objections: [], closing: c, weak: [] });
  } else {
    const weak = eligibleWeak(fr, school);
    for (let p = 0; p < P; p++) {
      for (const w0 of weak)
        for (const w1 of weak) if (w0 !== w1) out.push({ position: p, reasons: [], example: null, objections: [], closing: null, weak: [w0, w1] });
      for (const w0 of weak)
        for (let e = 0; e < E; e++) out.push({ position: p, reasons: [], example: e, objections: [], closing: null, weak: [w0] });
    }
  }
  return out;
}

/** The forty arguments for one topic and school. Deterministic. */
export function buildBank(fr: TopicFragments, closings: Closings, school: SchoolId): BankArgument[] {
  const rng = new Rng(`banks/v1/${fr.topic}/${school}`);
  const out: BankArgument[] = [];
  for (const tier of ["strong", "mid", "weak"] as const) {
    const pool = rng
      .shuffle(candidates(fr, school, tier, closings[school].length))
      .map((parts) => {
        const fitted = tier === "strong" ? fit(fr, closings, school, parts) : parts;
        return { parts: fitted, text: compose(fr, closings, school, fitted) };
      })
      .filter(({ text }) => wordCount(text) >= MIN_WORDS && wordCount(text) <= MAX_WORDS);
    // Spread the passages: prefer a candidate whose position and first
    // reason have been used least so far in this tier.
    const used = new Map<string, number>();
    const seen = new Set<string>();
    const chosen: { parts: Parts; text: string }[] = [];
    while (chosen.length < BANK_SIZE[tier]) {
      let best: { parts: Parts; text: string } | null = null;
      let bestScore = Infinity;
      for (const c of pool) {
        if (seen.has(c.text)) continue;
        const keys = [`p${c.parts.position}`, `r${c.parts.reasons[0] ?? -1}`, `w${c.parts.weak[0] ?? -1}`, `e${c.parts.example ?? -1}`];
        const score = keys.reduce((sum, k) => sum + (used.get(k) ?? 0), 0);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (!best) throw new Error(`bank ${fr.topic}.${school}: only ${chosen.length} ${tier} arguments fit`);
      seen.add(best.text);
      chosen.push(best);
      for (const k of [`p${best.parts.position}`, `r${best.parts.reasons[0] ?? -1}`, `w${best.parts.weak[0] ?? -1}`, `e${best.parts.example ?? -1}`])
        used.set(k, (used.get(k) ?? 0) + 1);
    }
    for (const c of chosen) {
      out.push({
        id: `${fr.topic}.${school}.${String(out.length + 1).padStart(2, "0")}`,
        topic: fr.topic,
        school,
        tier,
        parts: c.parts,
        text: c.text,
        words: wordCount(c.text),
      });
    }
  }
  return out;
}

export function bankPath(topic: TopicSlug, school: SchoolId): string {
  return join(ARGUMENT_DIR, `${topic}.${school}.json`);
}

export function serialiseBank(bank: BankArgument[]): string {
  return JSON.stringify(bank, null, 2) + "\n";
}

export function writeBanks(): string[] {
  const closings = loadClosings();
  const written: string[] = [];
  for (const topic of TOPICS) {
    const fr = loadFragments(topic);
    for (const school of SCHOOLS) {
      writeFileSync(bankPath(topic, school), serialiseBank(buildBank(fr, closings, school)));
      written.push(bankPath(topic, school));
    }
  }
  return written;
}

export interface Banks {
  fragments: Record<TopicSlug, TopicFragments>;
  closings: Closings;
  arguments: Record<string, BankArgument[]>; // key: `${topic}.${school}`
}

export function loadBanks(): Banks {
  const fragments = Object.fromEntries(TOPICS.map((t) => [t, loadFragments(t)])) as Record<TopicSlug, TopicFragments>;
  const args: Record<string, BankArgument[]> = {};
  for (const topic of TOPICS)
    for (const school of SCHOOLS)
      args[`${topic}.${school}`] = JSON.parse(readFileSync(bankPath(topic, school), "utf8"));
  return { fragments, closings: loadClosings(), arguments: args };
}

/**
 * A short span of `passage`, as it appears in it: what a template verdict
 * quotes. Whole words, no trailing punctuation, 5 to 12 words.
 */
export function quoteFrom(passage: string, rng: Rng): string {
  const sentences = passage.split(/(?<=[.!?])\s+/).filter((s) => wordCount(s) >= 5);
  const sentence = rng.pick(sentences.length ? sentences : [passage]);
  const words = sentence.split(/\s+/);
  const len = Math.min(words.length, rng.int(5, 12));
  const start = rng.int(0, words.length - len);
  return words
    .slice(start, start + len)
    .join(" ")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "");
}
