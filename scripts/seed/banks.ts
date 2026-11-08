// The argument banks: scripts/seed/arguments/<topic>.<school>.json, forty
// arguments each, for BANK_SCHOOLS, composed from the hand-written passages in
// arguments/fragments/<topic>.json and each motion's own closings,
// arguments/fragments/closings-by-motion.json.
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
import { QUIZ_SCHOOLS, type SchoolId as RegistrySchoolId } from "../../src/lib/school-registry";
import { DRAFT_SCHOOL_IDS, schoolEntry } from "../../src/lib/school-registry.drafts";
import quizV2 from "../../docs/quiz-v2.json";

export const SEED_DIR = join(process.cwd(), "scripts", "seed");
export const ARGUMENT_DIR = join(SEED_DIR, "arguments");

// The schools quiz v1 sorts into, from the registry: a sample account can
// only hold a school a reader could be placed in, and a run made before
// the launch places them by quiz v1.
export const SCHOOLS: readonly SchoolId[] = QUIZ_SCHOOLS;
export type SchoolId = RegistrySchoolId;

// The three schools the launch publishes, which are the registry's drafts
// until then (Arthur, 2026-11-07, Gate 4 item 13: argument banks "at the
// same depth as the live three's"). Their banks are written and tested with
// the others; the generator takes them up only in a run made with quiz v2
// (GenConfig.quiz), so a run made before the launch never reads them. Each
// has two objections, from two rivals, as the live three do: its named
// voices (src/lib/judge/objection-voices.ts), and for Ubuntu, whose
// criteria name one, Utilitarianism as well. Once the launch publishes them
// the drafts list is empty, and the tests that read LAUNCH_SCHOOLS have to
// name the three another way by then.
export const LAUNCH_SCHOOLS = DRAFT_SCHOOL_IDS;
/**
 * Every school with a bank: the six quiz v2 places readers in, in the quiz
 * file's order, as a run made with quiz v2 takes them. Not the registry's
 * lists, which the launch changes when it publishes the three.
 */
export const BANK_SCHOOLS: readonly SchoolId[] = Object.keys(quizV2.schools) as SchoolId[];
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

/**
 * Closings written for each motion (Arthur, 2026-11-08: "Closing lines
 * must fit their motion and not repeat stock phrases across arguments ...
 * Write closings per motion ... for all six schools' banks, so exemplar
 * pages never show the same ending twice"), in
 * arguments/fragments/closings-by-motion.json: four for each school on
 * each motion, as `closings.json` has four for each school. A run made
 * with quiz v2 (the fresh run) closes its arguments and exchange turns
 * with these, and the banks show them; a run that names no quiz keeps
 * `closings.json`, since the live run regenerates its rows from this code
 * until the teardown.
 */
export type MotionClosings = Record<TopicSlug, Closings>;

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

/**
 * "A Stoic", "An Ubuntu Ethicist", as the class page names a member with no
 * display name. Read from the full registry, drafts included, so a bank
 * reads the same whichever build writes it (the new three's banks name
 * each other as rivals).
 */
export function rivalIntro(school: SchoolId): string {
  const entry = schoolEntry(school);
  return `${entry?.adherentArticle === "an" ? "An" : "A"} ${entry?.adherent ?? school}`;
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

export function loadMotionClosings(): MotionClosings {
  return JSON.parse(readFileSync(join(ARGUMENT_DIR, "fragments", "closings-by-motion.json"), "utf8"));
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

const wordsOf = new Map<string, number>();
function words(text: string): number {
  let n = wordsOf.get(text);
  if (n === undefined) {
    n = wordCount(text);
    wordsOf.set(text, n);
  }
  return n;
}

/**
 * wordCount(compose(...)), without composing: every passage is joined to
 * the next with a space or a blank line, so the words add up
 * (tests/seed/banks.test.ts checks the two agree).
 */
export function partsWords(fr: TopicFragments, closings: Closings, school: SchoolId, parts: Parts): number {
  const s = fr.schools[school];
  let n = words(s.positions[parts.position]);
  if (parts.frame !== undefined) n += words(FRAMES[parts.frame]);
  for (const r of parts.reasons) n += words(s.reasons[r]);
  for (const w of parts.weak) n += words(fr.weak[w]);
  if (parts.example !== null) n += words(s.examples[parts.example]);
  for (const o of parts.objections) n += words(objectionSentence(s.objections[o]));
  if (parts.closing !== null) n += words(closings[school][parts.closing]);
  return n;
}

/**
 * Drops passages, least load-bearing first, until the text fits: the
 * example, then the closing, then a second reason. Used for revisions,
 * which add an objection to an argument that may already be long.
 */
export function fit(fr: TopicFragments, closings: Closings, school: SchoolId, parts: Parts): Parts {
  const p: Parts = { ...parts, reasons: [...parts.reasons], objections: [...parts.objections], weak: [...parts.weak] };
  const over = () => partsWords(fr, closings, school, p) > MAX_WORDS;
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

/**
 * A position that opens on a sentence stating only its stance: "I reject
 * the motion.", "I accept the motion only in part.", "The motion is
 * right.", "Do not deploy it as it stands.", "A Stoic can accept this
 * motion.", "I reject the motion's importance." and their like. 50 of the
 * 144 positions did, most of them a school's second, so on one exemplar
 * page up to five schools' cards opened on the same sentence (Arthur,
 * 2026-11-08: "repeated sentence openings ... across sample arguments and
 * exemplars"; and of "A Stoic can accept this motion.", that it reads as
 * filler). Where a qualification
 * carries a condition, the sentence after states it.
 */
export const BARE_STANCE =
  /^(?:I (?:reject|accept|support|oppose|agree with) (?:the|this) motion(?: as stated| as framed| with a condition| only in part)?|I agree that it is a mistake to say a model decides|I reject the motion's importance|It is not a mistake worth correcting|A model does not decide|A Stoic must deny that blame scales with harm|A (?:Stoic|utilitarian) (?:can|must|cannot|should) (?:accept|oppose) (?:this|the) motion|A utilitarian should not care much about this motion|The motion is right|(?:Do not )?[Dd]eploy it(?: as it stands)?|Deploying it is wrong as stated)\.\s+/;

/**
 * Five of the live three's positions (three Stoic, one Utilitarian, one
 * Virtue Ethics) the fresh run words differently: four so that no two
 * exemplar cards on a page open on the same three words, each having
 * opened as another of the live three's cards on its page did ("The
 * system should", "The motion is right:", "It is a mistake to say"), and
 * the Utilitarian one on the opaque benefit because, without "Deploy it."
 * before it, its "it" pointed at nothing. The live run reads these passages as written
 * until the teardown, so the change is made here, as the stance
 * sentences' is. The new three's passages are read only by a quiz v2 run
 * and are reworded where they stand. Keyed by motion, school and the position's index; `was` is the
 * passage as written, and a passage that no longer reads so is an error.
 */
export const FRESH_POSITIONS: Partial<Record<TopicSlug, Partial<Record<SchoolId, Record<number, { was: string; now: string }>>>>> = {
  "opaque-benefit": {
    utilitarianism: {
      0: {
        was: "Deploy it. The suffering it prevents is real, and an explanation was only ever valuable as a means to preventing harm.",
        now: "The suffering the system prevents is real, and an explanation was only ever valuable as a means to preventing harm.",
      },
    },
    "virtue-ethics": {
      0: {
        was: "The system should not be deployed on these terms, because justice to the person a decision lands on includes owing them an answer.",
        now: "On these terms the system should not be deployed, because justice to the person a decision lands on includes owing them an answer.",
      },
    },
    stoicism: {
      0: {
        was: "The system should be deployed if the people responsible judged the evidence soundly, because the soundness of a judgement does not depend on whether its reasons can be passed on.",
        now: "If the people responsible judged the evidence soundly, the system should be deployed, because the soundness of a judgement does not depend on whether its reasons can be passed on.",
      },
    },
  },
  "no-decision": {
    stoicism: {
      0: {
        was: "The motion is right: a decision is assent given to an impression by a ruling faculty, and a language model has neither, so the word is misapplied.",
        now: "Assent given to an impression by a ruling faculty is what a decision is, and a language model has neither, so the word is misapplied.",
      },
      3: {
        was: "It is a mistake to say a model decides, because deciding is something done by a rational soul assenting to how things appear, and nothing in the model assents.",
        now: "A rational soul decides by assenting to how things appear; nothing in the model assents, so it is a mistake to say a model decides.",
      },
    },
  },
};

/**
 * The passages a run made with quiz v2 (the fresh run) argues from: each
 * position without a sentence in front that states only its stance, so it
 * opens on its own claim, and the five in FRESH_POSITIONS reworded.
 * Everything else is as written. A run that names no quiz reads the
 * passages as they are, since the live run regenerates its rows from them.
 */
export function freshFragments(fr: TopicFragments): TopicFragments {
  const fresh = FRESH_POSITIONS[fr.topic] ?? {};
  return {
    ...fr,
    schools: Object.fromEntries(
      Object.entries(fr.schools).map(([school, s]) => [
        school,
        {
          ...s,
          positions: s.positions.map((p, i) => {
            const swap = fresh[school as SchoolId]?.[i];
            if (!swap) return p.replace(BARE_STANCE, "");
            if (p !== swap.was) throw new Error(`${fr.topic} ${school} position ${i} no longer reads as FRESH_POSITIONS has it`);
            return swap.now;
          }),
        },
      ])
    ) as TopicFragments["schools"],
  };
}

/** The banks show the fresh run's arguments: each motion's own closings, and positions that open on their claim. */
export function writeBanks(): string[] {
  const closings = loadMotionClosings();
  const written: string[] = [];
  for (const topic of TOPICS) {
    const fr = freshFragments(loadFragments(topic));
    for (const school of BANK_SCHOOLS) {
      writeFileSync(bankPath(topic, school), serialiseBank(buildBank(fr, closings[topic], school)));
      written.push(bankPath(topic, school));
    }
  }
  return written;
}

export interface Banks {
  fragments: Record<TopicSlug, TopicFragments>;
  /** A run that names no quiz closes with these. */
  closings: Closings;
  /** A run made with quiz v2 closes with these, each motion's own. */
  motionClosings: MotionClosings;
  arguments: Record<string, BankArgument[]>; // key: `${topic}.${school}`
}

/** The passages, closings and banks, with the banks of `schools` (quiz v1's three unless a run says otherwise). */
export function loadBanks(schools: readonly SchoolId[] = SCHOOLS): Banks {
  const fragments = Object.fromEntries(TOPICS.map((t) => [t, loadFragments(t)])) as Record<TopicSlug, TopicFragments>;
  const args: Record<string, BankArgument[]> = {};
  for (const topic of TOPICS)
    for (const school of schools)
      args[`${topic}.${school}`] = JSON.parse(readFileSync(bankPath(topic, school), "utf8"));
  return { fragments, closings: loadClosings(), motionClosings: loadMotionClosings(), arguments: args };
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
