import { SHOWN_SCHOOL_IDS, type SchoolId } from "@/lib/school-registry";
import type { PromptVersion } from "@/lib/judge/schema";
import { objectionVoiceFor } from "@/lib/judge/objection-voices";
import { DRAFT_CRITERIA_ON_THIS_BUILD } from "@/lib/judge/draft-criteria";

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

  // The three published at the launch (Arthur, 2026-11-07, Gate 4 item 6:
  // the criteria into rubric.ts at launch): each one's first two
  // paragraphs of the draft criteria file, word for word.
  confucian: `A faithful Confucian argument grounds its claim in roles and the
relationships that constitute them: you do not enter a relationship as a
finished individual, and what you owe attaches to a position rather than
being owed in the abstract. Its central terms are ren, the humaneness a
relationship realises, and li, the ritual propriety through which conduct is
done and learned. Cultivating oneself is native here, and proceeds through
roles and ritual rather than apart from them. Holding a name to its work,
after Book 13, is a strength where it appears.

Score fidelity down when the argument: reduces to what the system maximises
(utilitarian bleed); treats virtue as detached from roles, relationships and
ritual (virtue-ethics bleed); or asserts that relationships matter without
naming the relation, who owes what to whom, or what the position requires.`,

  ubuntu: `A faithful Ubuntu argument grounds its claim in relational personhood: a
person is a person through other persons, so the stake is what people become
through one another, not what an agent gets alone. Metz's principle is that
right action honours capacities for relationships of shared identity and
solidarity. Menkiti's achieved personhood and Gyekye's moderate reading,
which keeps individual worth, are both faithful. A harm reads as a failure of
relationship, not only a bad output.

Score fidelity down when the argument: maximises expected utility
(utilitarian bleed); treats the community as a single stakeholder; or asserts
that community matters without naming whose relationships are at stake or who
was left out. Leaning on communal expectation is faithful; ignoring the charge
that it pressures dissenters costs engagement, not fidelity.`,

  buddhist: `A faithful Buddhist argument grounds its claim in non-harm,
intention, compassion and liberation, weighing suffering, dukkha, as what is
at stake. Volition weighs as much as what follows, and non-harm covers what
one incites as well as what one does. Two commitments shape it: anatta, no
fixed, bounded self, and dependent origination, what arises coming from
conditions, not one cause. The discourse to Rahula asks, before acting, while
acting and after, whether it tends to harm oneself, another, or both. A
later tradition's inference, such as the Mahayana argument from anatta to
impartial compassion, is faithful when argued.

Score fidelity down when the argument: maximises aggregate welfare, ignoring
intention and non-harm (consequentialist bleed); uses a good intention to
excuse damage a careless actor would be blamed for; or asserts non-harm
without naming who is still hurt.`,
};

/** The schools published at the launch, judged under v3 only. */
const V3_ONLY: ReadonlySet<SchoolId> = new Set<SchoolId>(["confucian", "ubuntu", "buddhist"]);

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
 * Throwing is the safe failure here. It also throws for a school this
 * build does not show: since the launch the three new schools' criteria
 * are written here on every build, and a build without SIX_SCHOOLS must
 * still judge none of them, as before. `/api/judge` asks
 * `hasFidelityCriteria` first and refuses such a school cleanly, so this is
 * the backstop.
 */
export const FIDELITY_CRITERIA: Record<SchoolId, string> = new Proxy(
  CRITERIA_BY_SCHOOL as Record<SchoolId, string>,
  {
    get(target, key: string) {
      const criteria = SHOWN_SCHOOL_IDS.includes(key as SchoolId) ? target[key as SchoolId] : undefined;
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
// judge docked fidelity for missing terms ("Ren never appears", "Never
// names the outcome (...) as an indifferent"), so under v3 every school's
// criteria end with a paragraph that credits the concept whether or not
// the argument uses the school's words. The draft schools carry the same
// paragraph in their own section of the draft criteria file.
//
// Kept apart from CRITERIA_BY_SCHOOL so that v1 and v2 receive exactly
// what they always have: the live judge is v2 until the v3 switch, and the
// six request fixtures pin that byte for byte.
//
// When a draft school is published, its section of the draft criteria
// file is four paragraphs: the third is this one and the fourth is its
// entry in OBJECTION_V3 below. Split it: the first two go into
// CRITERIA_BY_SCHOOL, the third into this map and the fourth into that
// one. Moving all four into CRITERIA_BY_SCHOOL and then adding entries
// here would send both paragraphs twice.
const VOCABULARY_RULE_V3: Partial<Record<SchoolId, string>> = {
  stoicism: `Credit the concept, not the vocabulary. An argument that separates
what is up to the agent from what is not, and treats an outcome as neither
good nor bad in itself, is reasoning from the dichotomy of control and the
indifferents whether or not it uses those terms. Never mark fidelity down
for missing vocabulary alone.`,

  utilitarianism: `Credit the concept, not the vocabulary. An argument that
works out who is affected, by how much and how likely, and counts each
party's welfare impartially is reasoning about aggregate welfare whether or
not it uses the words utility, welfare or impartiality. Never mark fidelity
down for missing vocabulary alone.`,

  "virtue-ethics": `Credit the concept, not the vocabulary. An argument that
asks what a person of good judgment and character would do, places the
right act between too much and too little, and aims at a life lived well
over time is reasoning from practical wisdom, the mean and flourishing
whether or not it uses the words phronesis, eudaimonia or mean. Naming the
virtue at stake in plain words, such as courage or honesty, is naming it.
Never mark fidelity down for missing vocabulary alone.`,

  // The three published at the launch: each one's third paragraph of the
  // draft criteria file, word for word.
  confucian: `Credit the concept, not the vocabulary. An argument that reasons from what a
role requires, what the parties to a relationship owe one another, the
humaneness a relationship realises, and the propriety through which conduct
in it is done is reasoning from ren and li whether or not either word
appears. Never mark fidelity down for missing vocabulary alone.`,

  ubuntu: `Credit the concept, not the vocabulary. An argument that reasons from what
people become through one another, and reads a harm as a failure of
relationship and solidarity, is reasoning from relational personhood whether
or not it uses the word ubuntu, quotes the maxim, or names Metz, Menkiti or
Gyekye. Never mark fidelity down for missing vocabulary alone.`,

  buddhist: `Credit the concept, not the vocabulary. An argument that weighs suffering,
intention and non-harm, declines to treat the self as fixed and bounded,
and treats what happens as arising from many conditions rather than one
cause is reasoning from dukkha, anatta and dependent origination whether or
not it uses those terms. Never mark fidelity down for missing vocabulary
alone.`,
};

// v3 only. Arthur's ruling of 2026-11-03, after the 3 Nov golden run: in
// no sample did the judge raise the power objection that
// `confucian-hierarchy` leaves unanswered, which is a blind spot in the
// judge rather than a wrong band. So under v3 every school's criteria end
// with the objection that school is best known for having to answer,
// taken from the gets_wrong section of its page in content/schools, and
// an instruction to check engagement against it. Like the vocabulary
// paragraph it is kept out of CRITERIA_BY_SCHOOL, so v1 and v2, and the
// six request fixtures, are unchanged.
const OBJECTION_V3: Partial<Record<SchoolId, string>> = {
  stoicism: `The best-known objection to Stoicism is that it gives up on the
world too easily: if only your own judgment is up to you, there is no
argument for making an unfair system fairer, only for tolerating it with
good posture. Engagement should check whether the argument meets this
objection, and ignoring it costs engagement, not fidelity.`,

  utilitarianism: `The best-known objection to utilitarianism is that it
treats a whole society's welfare the way one person treats trade-offs across
their own life, netting one person's loss against other people's gains as
if a single subject bore both, when no total makes the trade fair to the
person who pays for it. Engagement should check whether the argument meets
this objection, and ignoring it costs engagement, not fidelity.`,

  "virtue-ethics": `The best-known objection to virtue ethics is that it
has no answer for scale: knowing your own character does not tell you which
policy saves more lives, and what a good person would do goes quiet exactly
when interests genuinely conflict. Engagement should check whether the
argument meets this objection, and ignoring it costs engagement, not
fidelity.`,

  // The three published at the launch (2026-11-08): each one's fourth
  // paragraph of the draft criteria file, word for word.
  confucian: `The best-known objection to Confucianism is that role ethics is too ready
to authorise hierarchy: mutual duties do not make unequal parties equals,
and a system can honour every expectation attaching to a role while leaving
the power between the parties where it found it. Engagement should check
whether the argument meets this objection, and ignoring it costs
engagement, not fidelity.`,

  ubuntu: `The best-known objection to Ubuntu is that a community is not one voice:
somebody decides what communal welfare means and who counts as inside, and
an appeal to communal expectation can make a dissenter the problem.
Engagement should check whether the argument meets this objection, and
ignoring it costs engagement, not fidelity.`,

  buddhist: `The best-known objection to Buddhist ethics is that it has much moral
teaching and little systematic moral philosophy of the kind the West built:
compassion and non-harm do not say who owns a dataset, who audits a model,
or how somebody appeals its decisions. That gap is a challenge for
reconstruction, not proof the tradition is deficient. Engagement should
check whether the argument meets this objection, and ignoring it costs
engagement, not fidelity.`,
};

/**
 * The criteria a given prompt version interpolates for a school.
 *
 * v1 and v2 get `FIDELITY_CRITERIA[school]` unchanged. Later versions get
 * the same text with the school's vocabulary paragraph after it, then its
 * objection paragraph, then which rival normally voices that objection
 * (src/lib/judge/objection-voices.ts, Arthur's ruling of 2026-11-03),
 * naming only rivals the prompt lists. Like `FIDELITY_CRITERIA`, it throws
 * for a school with no criteria, rather than handing the judge nothing.
 */
export function fidelityCriteriaFor(school: SchoolId, version: PromptVersion | "v3"): string {
  // One of the three on a SIX_SCHOOLS build (Gate 3): its approved section
  // of the draft criteria file, which already ends with its vocabulary and
  // objection paragraphs, and then the same voice paragraph a published
  // school gets, exactly as the golden runner has always built it for a
  // draft school (its planCase). Only under a prompt that
  // lists its rivals from the registry: v1 and v2 count the schools as
  // three, and a SIX_SCHOOLS build judges with v3.
  const draft = CRITERIA_BY_SCHOOL[school] === undefined ? DRAFT_CRITERIA_ON_THIS_BUILD[school] : undefined;
  if (draft !== undefined) {
    if (version === "v1" || version === "v2") {
      throw new Error(`judge/rubric: "${school}" can only be judged under a prompt that lists its rivals.`);
    }
    return `${draft.trimEnd()}\n\n${objectionVoiceFor(school, rivalsOf(school))}`;
  }
  const base = FIDELITY_CRITERIA[school];
  if (version === "v1" || version === "v2") {
    // The three published at the launch were only ever judged under v3,
    // whose prompt lists their rivals; v1 and v2 count the schools as three.
    if (V3_ONLY.has(school)) throw new Error(`judge/rubric: "${school}" can only be judged under a prompt that lists its rivals.`);
    return base;
  }
  const rule = VOCABULARY_RULE_V3[school];
  if (rule === undefined) {
    throw new Error(`judge/rubric: no v3 vocabulary paragraph for school "${school}".`);
  }
  const objection = OBJECTION_V3[school];
  if (objection === undefined) {
    throw new Error(`judge/rubric: no v3 objection paragraph for school "${school}".`);
  }
  const voice = objectionVoiceFor(school, rivalsOf(school));
  return `${base}\n\n${rule}\n\n${objection}\n\n${voice}`;
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
  // A school this build does not show has none to give: since the launch
  // the three's criteria live here on every build, and a build without
  // SIX_SCHOOLS still refuses them, as before.
  if (!SHOWN_SCHOOL_IDS.includes(id)) return false;
  return CRITERIA_BY_SCHOOL[id] !== undefined || DRAFT_CRITERIA_ON_THIS_BUILD[id] !== undefined;
}

/**
 * The schools a v3 prompt lists as rivals to `school`: every school this
 * build shows but its own. The published three on a build without the
 * flag; all six on a SIX_SCHOOLS build, where the three join the rival
 * list (Gate 3). The prompt's list is built from the same registry
 * (RIVAL_SCHOOLS_BLOCK in src/lib/anthropic.ts) and says the objection may
 * not come from the assigned school.
 */
export function rivalsOf(school: SchoolId): SchoolId[] {
  return SHOWN_SCHOOL_IDS.filter((id) => id !== school);
}

/** The schools that can be judged: shown on this build, and with criteria. */
export function judgeableSchools(): SchoolId[] {
  return SHOWN_SCHOOL_IDS.filter((id) => hasFidelityCriteria(id));
}
