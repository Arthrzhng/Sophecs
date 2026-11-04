import type { SchoolId } from "@/lib/school-registry";

/**
 * Which rival school normally voices each school's best-known objection,
 * and why. v3 only.
 *
 * Arthur's ruling of 2026-11-03, after two v3 runs in which the judge
 * never returned the power objection on the Confucian hierarchy cases: it
 * has to put the objection in a rival school's mouth, and nothing told it
 * which. He set Confucianism's voices himself and asked for the same
 * exercise for all six, symmetrically. The other five are drafted from
 * each school's page in content/schools, and are his to confirm at
 * Checkpoint A.
 *
 * A voice is named to the judge only when its school is one of the rivals
 * the prompt lists. A rival outside that list could not be returned
 * (`unanswered_objection.school` is validated against it), so naming one
 * would invite a reply that fails validation. That is what "once
 * published" means in practice: Ubuntu's voice for Confucianism reaches the
 * judge on the day Ubuntu is listed, with no edit here.
 *
 * Every school has at least one voice among the three published schools,
 * so every v3 request names one. tests/objection-voices.test.ts holds that.
 */
export const OBJECTION_VOICES: Record<SchoolId, ReadonlyArray<{ rival: SchoolId; why: string }>> = {
  // The objection: it gives up on the world too easily.
  stoicism: [
    {
      rival: "utilitarianism",
      why: "the harm an unfair system does is a sum someone could reduce, and declining to try is itself a choice about that harm",
    },
    {
      rival: "ubuntu",
      why: "a person is a person through other persons, so standing apart from an unfair system leaves the people inside it on their own",
    },
  ],
  // The objection: no total makes the trade fair to the person who pays.
  utilitarianism: [
    {
      rival: "virtue-ethics",
      why: "justice gives each person what is owed to them, and a total owes nobody anything",
    },
    {
      rival: "ubuntu",
      why: "each person's capacity for relationship is to be honoured, not netted against other people's gains",
    },
  ],
  // The objection: it has no answer for scale.
  "virtue-ethics": [
    {
      rival: "utilitarianism",
      why: "a policy that touches thousands of people needs its outcomes compared, and asking what a good person would do does not compare them",
    },
  ],
  // The objection: role ethics is too ready to authorise hierarchy. Both
  // voices are Arthur's, in his words.
  confucian: [
    {
      rival: "utilitarianism",
      why: "the subordinate party's interests go uncounted when the stronger party sets the terms",
    },
    {
      rival: "ubuntu",
      why: "solidarity requires the weaker party can be heard",
    },
  ],
  // The objection: a community is not one voice.
  ubuntu: [
    {
      rival: "stoicism",
      why: "a dissenter's own judgment is the one thing the community cannot decide for them",
    },
  ],
  // The objection: much moral teaching, little systematic moral philosophy.
  buddhist: [
    {
      rival: "utilitarianism",
      why: "deciding who audits a model and how an appeal is weighed takes a way of comparing everyone's claims, which compassion alone does not supply",
    },
    {
      rival: "confucian",
      why: "who answers to whom for a model is a question of roles and what each owes, which non-harm leaves unassigned",
    },
  ],
};

/**
 * The sentence that tells the judge who voices this school's best-known
 * objection, naming only rivals in `rivals`.
 *
 * Throws when none of the school's voices is among them, rather than
 * sending a request that names no voice: every school is meant to have one
 * among the published schools, and a gap is a mistake to fix here.
 */
export function objectionVoiceFor(school: SchoolId, rivals: readonly SchoolId[]): string {
  const voices = OBJECTION_VOICES[school].filter((v) => v.rival !== school && rivals.includes(v.rival));
  if (voices.length === 0) {
    throw new Error(`judge/objection-voices: no listed rival voices the known objection to "${school}".`);
  }
  const named = voices.map((v) => `\`${v.rival}\` (${v.why})`).join(", or ");
  return (
    `Of the rival schools this prompt lists, the one that normally voices this objection is ${named}. ` +
    `When the argument leaves the objection unmet, return it in that school's voice.`
  );
}
