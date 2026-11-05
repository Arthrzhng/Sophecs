// Template verdicts for sample arguments. No judge is called: every verdict
// here is written from the argument's own passages, says so through
// `prompt_version` and `debates.verdict_is_template`, and is shown on the
// verdict page as a sample assessment (src/components/debate/Verdict.tsx).
//
// Each one has the shape the real judge returns (src/lib/judge/schema.ts),
// within its word limits, so the verdict page renders it as it renders any
// verdict; tests/seed/verdicts.test.ts parses every template through the
// real schema.
//
// The scores follow one documented rule, because the judge's own prompt
// gives none: the composite is ten times a weighted mean of the three
// criteria, fidelity counting double, 10 x (0.5 F + 0.25 R + 0.25 E),
// moved by at most 2 points of noise and held inside the tier's range
// (strong 70-90, mid 50-70, weak 25-50).

import type { Rng } from "./rng";
import { schoolAdherent, schoolName } from "../../src/lib/school-registry";
import {
  rivalIntro,
  quoteFrom,
  type BankArgument,
  type Objection,
  type Parts,
  type SchoolId,
  type Tier,
  type TopicFragments,
} from "./banks";

export const TEMPLATE_PROMPT_VERSION = "sample-template-1";

export const SCORE_RANGE: Record<Tier, [number, number]> = {
  strong: [70, 90],
  mid: [50, 70],
  weak: [25, 50],
};

const AXIS_BANDS: Record<Tier, { f: [number, number]; r: [number, number]; e: [number, number] }> = {
  strong: { f: [7, 9], r: [6.5, 8.5], e: [6, 8.5] },
  mid: { f: [5, 7.5], r: [5, 7], e: [2.5, 5] },
  weak: { f: [2, 5], r: [2.5, 5], e: [1, 3.5] },
};

const NAME = (s: SchoolId) => schoolName(s);
const ADHERENT = (s: SchoolId) => schoolAdherent(s);

// What each school's own ground is, in the words a verdict uses to praise
// an argument for standing on it. Sample text keyed by school, as the
// fidelity criteria are; not a list the product reads.
const FEATURE: Record<SchoolId, string[]> = {
  stoicism: [
    "keeps to the line between what is up to us and what is not",
    "puts the weight on judgement rather than on outcome",
    "reasons from assent, which is where a Stoic places responsibility",
  ],
  utilitarianism: [
    "counts everyone affected and weighs the outcomes",
    "treats each person's welfare impartially",
    "ties the conclusion to consequences that could be checked",
  ],
  "virtue-ethics": [
    "asks what the practice does to the character of the people in it",
    "reasons from practical wisdom rather than from a rule",
    "treats the question as one of what a good person would do",
  ],
};

export interface Verdict {
  rejected: false;
  score: number;
  fidelity: number;
  rigor: number;
  engagement: number;
  strongest_move: string;
  weakest_move: string;
  a_stronger_version_would: string;
  verdict_line: string;
  unanswered_objection: { school: SchoolId; claim: string; why_it_stands: string } | null;
  objection_answered?: boolean;
  improvement_note?: string;
  prompt_version: string;
}

export interface Rejection {
  rejected: true;
  rejection_reason: string;
  prompt_version: string;
}

const REJECTIONS = [
  "This states an opinion about AI without arguing the motion from the school's position, so there is nothing here to score.",
  "It does not take a position on the motion as written; it argues about a related question instead.",
  "Most of this is about technology in general. It needs to argue the motion itself from the school's own commitments.",
];

const half = (x: number) => Math.round(x * 2) / 2;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function compositeScore(f: number, r: number, e: number): number {
  return 10 * (0.5 * f + 0.25 * r + 0.25 * e);
}

function axes(tier: Tier, skill: number, rng: Rng) {
  const b = AXIS_BANDS[tier];
  // skill in [0, 1] leans each axis towards the top of its band.
  const draw = ([lo, hi]: [number, number]) => half(clamp(lo + (hi - lo) * (0.5 * skill + 0.5 * rng.next()), lo, hi));
  return { f: draw(b.f), r: draw(b.r), e: draw(b.e) };
}

function scoreFor(tier: Tier, f: number, r: number, e: number, rng: Rng): number {
  const [lo, hi] = SCORE_RANGE[tier];
  return clamp(Math.round(compositeScore(f, r, e) + rng.int(-2, 2)), lo, hi);
}

/** The rival whose objection the argument does not answer. */
export function unansweredRival(fr: TopicFragments, school: SchoolId, parts: Parts, rng: Rng): number {
  const all = fr.schools[school].objections.map((_, i) => i);
  const open = all.filter((i) => !parts.objections.includes(i));
  return rng.pick(open.length ? open : all);
}

function objectionBlock(o: Objection) {
  return { school: o.rival, claim: cap(o.claim), why_it_stands: o.why };
}

export function templateVerdict(
  fr: TopicFragments,
  arg: Pick<BankArgument, "school" | "tier">,
  parts: Parts,
  skill: number,
  rng: Rng
): Verdict {
  const s = fr.schools[arg.school];
  const { f, r, e } = axes(arg.tier, skill, rng);
  const score = scoreFor(arg.tier, f, r, e, rng);
  const openIdx = unansweredRival(fr, arg.school, parts, rng);
  const open = s.objections[openIdx];
  const rivalName = NAME(open.rival);
  const feature = rng.pick(FEATURE[arg.school]);

  let strongest: string;
  let weakest: string;
  let stronger: string;
  let line: string;
  if (arg.tier === "weak") {
    const q = quoteFrom(s.positions[parts.position], rng);
    const wq = quoteFrom(parts.weak.length ? fr.weak[parts.weak[0]] : s.examples[parts.example ?? 0], rng);
    strongest = `The opening, "${q}", states the ${NAME(arg.school)} position clearly, though little after it reasons from that position.`;
    weakest = `"${wq}" is an opinion about the topic rather than a reason a ${ADHERENT(arg.school)} would give, and most of the argument is like it.`;
    const reasonSentence = shortestSentence(s.reasons);
    stronger = `argue from what a ${ADHERENT(arg.school)} actually holds, for instance: ${reasonSentence}`;
    line = rng.pick([
      `States a ${NAME(arg.school)} position but argues mostly from general opinion.`,
      `The position is ${NAME(arg.school)}'s; the reasons offered for it are not.`,
    ]);
  } else {
    const q = quoteFrom(s.reasons[parts.reasons[0]], rng);
    strongest = `"${q}" ${feature}, on the school's own ground.`;
    const weakSource =
      parts.example !== null ? s.examples[parts.example] : s.reasons[parts.reasons[parts.reasons.length - 1]];
    const wq = quoteFrom(weakSource, rng);
    if (arg.tier === "strong") {
      weakest = `"${wq}" is asserted more than shown, and it carries weight the argument never quite earns.`;
      stronger = `also answer the ${rivalName} objection, that ${open.claim} As it stands the argument leaves that reply to the reader.`;
      line = rng.pick([
        `A faithful ${NAME(arg.school)} case that meets one objection head on.`,
        `Reasons as a ${ADHERENT(arg.school)} reasons, and answers a hard reply.`,
      ]);
    } else {
      weakest = `The argument never meets an objection. "${wq}" is left to stand alone where a rival school would push hardest.`;
      stronger = `take on the ${rivalName} objection directly. ${rivalIntro(open.rival)} would say that ${open.claim} The argument needs an answer to that.`;
      line = rng.pick([
        `A sound ${NAME(arg.school)} case that leaves its strongest objection unanswered.`,
        `Faithful to ${NAME(arg.school)}, but it never faces the obvious reply.`,
      ]);
    }
  }

  return {
    rejected: false,
    score,
    fidelity: f,
    rigor: r,
    engagement: e,
    strongest_move: strongest,
    weakest_move: weakest,
    a_stronger_version_would: stronger,
    verdict_line: line,
    unanswered_objection: objectionBlock(open),
    prompt_version: TEMPLATE_PROMPT_VERSION,
  };
}

/**
 * A revision's verdict: the revision adds the answer to the objection the
 * original's verdict named, so engagement rises and the objection is
 * marked answered. `answered` false is a revision that tried and missed.
 */
export function templateRevisionVerdict(
  fr: TopicFragments,
  school: SchoolId,
  tier: Tier,
  parentVerdict: Verdict,
  revisedParts: Parts,
  answeredIdx: number,
  answered: boolean,
  rng: Rng
): Verdict {
  const s = fr.schools[school];
  const f = half(clamp(parentVerdict.fidelity + rng.float(0, 0.5), 0, 10));
  const r = half(clamp(parentVerdict.rigor + rng.float(0, 0.5), 0, 10));
  const e = half(clamp(parentVerdict.engagement + (answered ? rng.float(2, 3.5) : rng.float(0, 1)), 0, 9.5));
  const score = clamp(Math.round(compositeScore(f, r, e) + rng.int(-1, 2)), 25, 90);
  const added = s.objections[answeredIdx];
  const q = quoteFrom(added.answer, rng);
  const remaining = s.objections.map((_, i) => i).filter((i) => !revisedParts.objections.includes(i));
  // The judge's schema always names an objection. When the revision now
  // meets both rivals, the one it met first is named as met only thinly.
  const next = remaining.length
    ? objectionBlock(s.objections[rng.pick(remaining)])
    : {
        ...objectionBlock(s.objections[revisedParts.objections[0]]),
        why_it_stands: `The reply to it is stated rather than argued, so a determined ${ADHERENT(s.objections[revisedParts.objections[0]].rival)} could press it again.`,
      };
  const base = templateVerdict(fr, { school, tier }, revisedParts, 0.5, rng);
  return {
    ...base,
    score,
    fidelity: f,
    rigor: r,
    engagement: e,
    verdict_line: answered
      ? `Now answers the ${NAME(added.rival)} objection on ${NAME(school)}'s own terms.`
      : `Tries to answer the ${NAME(added.rival)} objection but restates the position instead.`,
    unanswered_objection: next,
    objection_answered: answered,
    improvement_note: answered
      ? `"${q}" meets the ${NAME(added.rival)} objection directly, which the first attempt did not.`
      : `The new paragraph names the ${NAME(added.rival)} objection, but "${q}" restates the position more than it answers it.`,
    prompt_version: TEMPLATE_PROMPT_VERSION,
  };
}

export function templateRejection(rng: Rng): Rejection {
  return { rejected: true, rejection_reason: rng.pick(REJECTIONS), prompt_version: TEMPLATE_PROMPT_VERSION };
}

function shortestSentence(passages: string[]): string {
  const sentences = passages.flatMap((p) => p.split(/(?<=[.!?])\s+/));
  return sentences.reduce((a, b) => (b.split(/\s+/).length < a.split(/\s+/).length && b.split(/\s+/).length >= 8 ? b : a));
}
