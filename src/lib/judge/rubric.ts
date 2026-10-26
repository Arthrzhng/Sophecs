import { PUBLISHED_SCHOOL_IDS, type SchoolId } from "@/lib/school-registry";
import type { PromptVersion } from "@/lib/judge/schema";

// Fidelity criteria per school — what makes an argument a genuine instance
// of that school's reasoning, not just reasoning that happens to reach a
// position the school would agree with. Drafted by Claude at Arthur's
// request (he asked for a draft rather than writing these himself — see
// docs/decisions.md). Bump the prompt version if these change, per the
// brief's golden-set discipline.
//
// A registry extension point: the criteria themselves are judge content
// and are Arthur's to write, so this map holds only the schools somebody
// has written criteria for, and `CRITERIA_BY_SCHOOL` below is where a new
// school's go.
const CRITERIA_BY_SCHOOL: Partial<Record<SchoolId, string>> = {
  stoicism: `A faithful Stoic argument grounds its claim in the dichotomy of
control: judgments, desires, and one's own choices are "up to us"; outcomes,
others' actions, health, reputation, and death are not. It treats virtue
(wisdom, justice, courage, temperance) as the only true good and externals as
"indifferents" — preferred or dispreferred, never intrinsically good or bad.
It should locate emotional disturbance in false judgments about externals,
not in the externals themselves, and frame right action as living in
accordance with reason and nature.

Score fidelity down when the argument: relies on aggregate-welfare
calculation instead of the control distinction (utilitarian reasoning in
Stoic dress); treats an external outcome as intrinsically good or bad rather
than indifferent; or amounts to generic "stay calm / toughen up" advice
without grounding in what is and isn't up to the agent.`,

  utilitarianism: `A faithful utilitarian argument grounds its claim in
consequences: it identifies who is affected, weighs the magnitude and
likelihood of benefit and harm to each, and argues for whichever action
maximizes aggregate welfare, with every affected party's welfare counted
impartially — not just the agent's, and not just one favored group's. It
should engage with the actual scale of costs and benefits, not merely assert
a direction ("this helps people").

Score fidelity down when the argument: appeals to rights, duty, or virtue as
the reason an act is right, with consequences merely mentioned in passing;
ignores costs or harms to any affected party entirely; or asserts a utility
conclusion without any comparison of magnitudes.`,

  "virtue-ethics": `A faithful virtue-ethics argument grounds its claim in
what a person of practical wisdom (phronesis) and good character would do,
identifies the specific virtue at stake (courage, justice, temperance,
honesty, etc.), and situates the right action as the mean between an excess
and a deficiency of that virtue. It treats the aim of ethical life as
flourishing (eudaimonia) achieved through virtuous activity over time, not a
single calculation, and attends to the agent's character and motives, not
just the act's conformity to a rule or its aggregate effect.

Score fidelity down when the argument: reduces to "this produces the most
good" without reference to character or virtue (utilitarian bleed); reduces
to "externals don't matter, only my judgments do" (Stoic bleed); or asserts
"a good person would do X" without naming the virtue at stake or the excess
and deficiency it sits between.`,
};

/**
 * The criteria the judge prompt interpolates, keyed by school.
 *
 * Typed and read as a total record, because that is what the judge path
 * expects, but backed by a proxy that throws on a school nobody has
 * written criteria for. The alternative was returning undefined, which
 * `src/lib/anthropic.ts` would substitute into the prompt as the literal
 * string "undefined" and send to the model: a verdict produced against no
 * criteria at all, and nothing to show it had happened.
 *
 * Throwing is the safe failure here. A draft school cannot reach the judge
 * today, because `profiles.school` is constrained to the published three,
 * so this guards the window between 2C widening that constraint and a new
 * school's criteria being written. `/api/judge` would answer 500 rather
 * than judging; it should learn to refuse gracefully before any new school
 * is published, which is a 2E question and is not in this branch.
 */
export const FIDELITY_CRITERIA: Record<SchoolId, string> = new Proxy(
  CRITERIA_BY_SCHOOL as Record<SchoolId, string>,
  {
    get(target, key: string) {
      const criteria = target[key as SchoolId];
      if (criteria === undefined) {
        throw new Error(
          `judge/rubric: no fidelity criteria for school "${key}". ` +
            `A school cannot be judged against another school's criteria.`
        );
      }
      return criteria;
    },
  }
);

// v3 only. Arthur's ruling of 2026-10-26, after the 2F golden runs: the v3
// judge docked fidelity for missing terms ("Ren never appears", "never
// names the outcome as an indifferent"), so under v3 every school's
// criteria end with a paragraph that credits the concept whether or not
// the argument uses the school's words. The draft schools carry the same
// paragraph in their own section of the draft criteria file.
//
// Kept apart from CRITERIA_BY_SCHOOL so that v1 and v2 receive exactly
// what they always have: the live judge is v2 until the v3 switch, and the
// six request fixtures pin that byte for byte.
const VOCABULARY_RULE_V3: Partial<Record<SchoolId, string>> = {
  stoicism: `Credit the concept, not the vocabulary. An argument that separates
what is up to the agent from what is not, treats an outcome as neither good
nor bad in itself, or traces distress to a judgment rather than to an event
is reasoning from the dichotomy of control and the indifferents whether or
not it uses those terms. Never mark fidelity down for missing vocabulary
alone.`,

  utilitarianism: `Credit the concept, not the vocabulary. An argument that
works out who is affected, by how much and how likely, and counts each
party's welfare impartially is reasoning about aggregate welfare whether or
not it uses the words utility, welfare or impartiality. Never mark fidelity
down for missing vocabulary alone.`,

  "virtue-ethics": `Credit the concept, not the vocabulary. An argument that
asks what a person of good judgment and character would do, and places the
right act between too much and too little, is reasoning from practical
wisdom and the mean whether or not it uses the words phronesis, eudaimonia
or mean. Naming the virtue at stake in plain words, such as courage or
honesty, is naming it. Never mark fidelity down for missing vocabulary
alone.`,
};

/**
 * The criteria a given prompt version interpolates for a school.
 *
 * v1 and v2 get `FIDELITY_CRITERIA[school]` unchanged. Later versions get
 * the same text with the school's vocabulary paragraph after it. Like
 * `FIDELITY_CRITERIA`, it throws for a school with no criteria, rather
 * than handing the judge nothing.
 */
export function fidelityCriteriaFor(school: SchoolId, version: PromptVersion | "v3"): string {
  const base = FIDELITY_CRITERIA[school];
  if (version === "v1" || version === "v2") return base;
  const rule = VOCABULARY_RULE_V3[school];
  if (rule === undefined) {
    throw new Error(`judge/rubric: no v3 vocabulary paragraph for school "${school}".`);
  }
  return `${base}\n\n${rule}`;
}

/**
 * Whether this school has fidelity criteria, asked without reading them.
 *
 * Reading `FIDELITY_CRITERIA[school]` for a school that has none throws,
 * which is right at the point of use and wrong as a way to find out. The
 * route asks this first so it can refuse the submission cleanly instead of
 * failing.
 */
export function hasFidelityCriteria(id: SchoolId): boolean {
  return CRITERIA_BY_SCHOOL[id] !== undefined;
}

/** The schools that can be judged: published, and with criteria written. */
export function judgeableSchools(): SchoolId[] {
  return PUBLISHED_SCHOOL_IDS.filter((id) => CRITERIA_BY_SCHOOL[id] !== undefined);
}
