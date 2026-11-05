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
// The scores follow a documented rule, because the judge's own prompt
// gives none: the composite is ten times a weighted mean of the three
// criteria, fidelity counting double, 10 x (0.5 F + 0.25 R + 0.25 E), plus
// a little noise. There are two versions of it.
//
// Rule 1, the first, gives criteria in half points and holds the composite
// inside the tier's range (strong 70-90, mid 50-70, weak 25-50) by
// clamping. Both read as generated: the judge has never given a half point
// (418 scored replies in tests/judge/golden-runs, every criterion a whole number),
// and the clamp piles scores on the range's ends, so 23.3% of the first
// run's composites were multiples of 5, against the judge's 16.3%.
//
// Rule 2 gives whole-number criteria, drawn as rule 1 draws them but from
// bands that reach past it, lets the composite fall where the criteria put
// it, with no tier range to pile against, and moves four in ten composites
// that land on a multiple of 5 by one or two points, and three in ten of
// the criteria that land on 0, 5 or 10 by one. scripts/seed/ci.ts refuses a run
// whose rule-2 scores are more than MAX_ROUND_SCORE_PCT round.
//
// Which rule a verdict follows is decided by scoreRuleFor: rows dated from
// SCORE_RULE_2_FROM, and every row of a run begun after it, follow rule 2.
// The run begun on 2026-11-05 wrote its rows under rule 1 up to then, and
// those rows regenerate exactly as written; scripts/seed/ci.ts compares
// every stored sample score with the plan before each run writes. They go
// at launch, with the run.
//
// Rule 2 makes every draw rule 1 makes, in the same order, and takes its
// numbers from a stream of its own, so a rule-2 verdict differs from the
// rule-1 verdict for the same row in its four numbers and its
// prompt_version and in nothing else.

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
export const TEMPLATE_PROMPT_VERSION_2 = "sample-template-2";

export type ScoreRule = 1 | 2;

/**
 * Rows dated from here, and every row of a run begun from here, follow
 * rule 2. It must lie after every row a run has written under rule 1: the
 * live run's window ended at 2026-11-05T14:57Z when rule 2 shipped, and the
 * margin to here covers a merge made late. Moving it earlier than a written
 * row would change that row; ci.ts refuses a run whose stored scores
 * differ from its plan, so such a move fails before it writes.
 */
export const SCORE_RULE_2_FROM = "2026-11-06T06:00:00.000Z";

export function scoreRuleFor(rowTime: number, runBaseTo: number): ScoreRule {
  const from = Date.parse(SCORE_RULE_2_FROM);
  return rowTime >= from || runBaseTo >= from ? 2 : 1;
}

export const promptVersionFor = (rule: ScoreRule) => (rule === 2 ? TEMPLATE_PROMPT_VERSION_2 : TEMPLATE_PROMPT_VERSION);

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

// ---- rule 2 ----

// Drawn from continuous bands and rounded, so a whole number at a band's
// edge is not drawn half as often as its neighbours; the tiers' bands
// overlap, so that no whole number is rare because it sits where one
// tier's band stops and the next begins; and the edges were set by
// measurement, so that a fresh run's composites fall in the plan's score
// bands (70-90 / 50-69 / 25-49) close to 25 / 50 / 25.
const AXIS_BANDS_2: Record<Tier, { f: [number, number]; r: [number, number]; e: [number, number] }> = {
  strong: { f: [6.8, 9.4], r: [5.8, 9.2], e: [4.4, 8.4] },
  mid: { f: [4.6, 8.2], r: [4.2, 7.6], e: [2.4, 6.2] },
  weak: { f: [1.8, 5.8], r: [1.8, 5.4], e: [0.8, 3.8] },
};

/** A whole-number criterion: three in ten that land on 0, 5 or 10 move one point, inside 0-10. */
function criterion(x: number, rng: Rng): number {
  let v = clamp(Math.round(x), 0, 10);
  if (v % 5 === 0 && rng.chance(0.3)) v = v === 0 ? 1 : v === 10 ? 9 : v + (rng.chance(0.5) ? 1 : -1);
  return v;
}

/**
 * The composite from whole-number criteria. The noise is the sum of two
 * draws, so it is likelier small than large and smooths over the 2.5-point
 * steps whole-number criteria leave in the weighted mean. Four in ten that
 * land on a multiple of 5 move one or two points.
 */
function composite2(f: number, r: number, e: number, noise: number, rng: Rng): number {
  let s = clamp(Math.round(compositeScore(f, r, e) + noise), 1, 99);
  if (s % 5 === 0 && rng.chance(0.4)) s += rng.pick([-2, -1, 1, 2]);
  return s;
}

function scoresRule2(tier: Tier, skill: number, rng: Rng) {
  const b = AXIS_BANDS_2[tier];
  const draw = ([lo, hi]: [number, number]) => criterion(lo + (hi - lo) * (0.5 * skill + 0.5 * rng.next()), rng);
  const f = draw(b.f);
  const r = draw(b.r);
  const e = draw(b.e);
  return { f, r, e, score: composite2(f, r, e, rng.float(-2, 2) + rng.float(-2, 2), rng) };
}

/**
 * A revision's numbers under rule 2. As under rule 1, no criterion falls
 * below the original's, and engagement rises when the objection is
 * answered: here by at least a point, and to no more than 9, as rule 1
 * keeps it below 10. The original may be a rule-1 verdict in half points.
 */
function revisionScoresRule2(parent: Pick<Verdict, "fidelity" | "rigor" | "engagement">, answered: boolean, rng: Rng) {
  const f = Math.max(Math.round(parent.fidelity), criterion(parent.fidelity + rng.float(0, 0.8), rng));
  const r = Math.max(Math.round(parent.rigor), criterion(parent.rigor + rng.float(0, 0.8), rng));
  const raised = criterion(parent.engagement + (answered ? rng.float(2, 3.5) : rng.float(0, 1)), rng);
  const e = Math.min(9, Math.max(Math.round(parent.engagement) + (answered ? 1 : 0), raised));
  return { f, r, e, score: composite2(f, r, e, rng.float(-1, 1.5) + rng.float(-1, 1.5), rng) };
}

/** Rule 2's numbers come from a stream of their own (see the header). */
const RULE_2_STREAM = "score-rule-2";

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
  rng: Rng,
  rule: ScoreRule = 1
): Verdict {
  const s = fr.schools[arg.school];
  // Rule 1's draws are made under either rule, so the rest of the verdict
  // draws exactly as it did; rule 2 then takes its numbers from its own stream.
  const one = axes(arg.tier, skill, rng);
  const oneScore = scoreFor(arg.tier, one.f, one.r, one.e, rng);
  const { f, r, e, score } = rule === 2 ? scoresRule2(arg.tier, skill, rng.fork(RULE_2_STREAM)) : { ...one, score: oneScore };
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
    prompt_version: promptVersionFor(rule),
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
  rng: Rng,
  rule: ScoreRule = 1
): Verdict {
  const s = fr.schools[school];
  // As in templateVerdict: rule 1's draws first, under either rule.
  const f1 = half(clamp(parentVerdict.fidelity + rng.float(0, 0.5), 0, 10));
  const r1 = half(clamp(parentVerdict.rigor + rng.float(0, 0.5), 0, 10));
  const e1 = half(clamp(parentVerdict.engagement + (answered ? rng.float(2, 3.5) : rng.float(0, 1)), 0, 9.5));
  const score1 = clamp(Math.round(compositeScore(f1, r1, e1) + rng.int(-1, 2)), 25, 90);
  const { f, r, e, score } =
    rule === 2 ? revisionScoresRule2(parentVerdict, answered, rng.fork(RULE_2_STREAM)) : { f: f1, r: r1, e: e1, score: score1 };
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
    prompt_version: promptVersionFor(rule),
  };
}

/** A rejection has no numbers; its prompt_version still names the rule of its row. */
export function templateRejection(rng: Rng, rule: ScoreRule = 1): Rejection {
  return { rejected: true, rejection_reason: rng.pick(REJECTIONS), prompt_version: promptVersionFor(rule) };
}

function shortestSentence(passages: string[]): string {
  const sentences = passages.flatMap((p) => p.split(/(?<=[.!?])\s+/));
  return sentences.reduce((a, b) => (b.split(/\s+/).length < a.split(/\s+/).length && b.split(/\s+/).length >= 8 ? b : a));
}
