import type { SchoolId } from "@/lib/types";

// Fidelity criteria per school — what makes an argument a genuine instance
// of that school's reasoning, not just reasoning that happens to reach a
// position the school would agree with. Drafted by Claude at Arthur's
// request (he asked for a draft rather than writing these himself — see
// docs/decisions.md); intended to be reviewed/edited before the judge comes
// off KILL_SWITCH_JUDGE. Bump the prompt version if these change after
// review, per the brief's golden-set discipline.
export const FIDELITY_CRITERIA: Record<SchoolId, string> = {
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
