import { getAllTopicFiles } from "./topics";
import type { TopicListItem, TopicStatus } from "@/components/debate/TopicList";
import type { VerdictData } from "@/components/debate/Verdict";

/**
 * Fixtures for /styleguide/arena, the local preview of the debate surface.
 *
 * Every arena screen needs both a session and rows in Supabase, so none of
 * them renders on a machine that has neither — which is every machine
 * except a signed-in browser pointed at production. That makes the arena
 * the one part of the product that cannot be looked at while it is being
 * built, and looking at it is how the last two phases caught their real
 * mistakes.
 *
 * The topic rows are read from content/topics/*.md rather than invented,
 * so the list is the real six motions with the real stances. The verdict is
 * the one thing here that is written rather than read: no judge output is
 * checked into the repo, and calling the judge to produce one would spend
 * money to draw a screen.
 */

// One motion in each state the list can show, so the preview exercises all
// four rather than six copies of "Open".
const TOPIC_BEST: Record<string, number> = {
  "opaque-benefit": 71,
  "crash-arithmetic": 64,
};

const TOPIC_STATUS: Record<string, TopicStatus> = {
  "opaque-benefit": "judged",
  "crash-arithmetic": "locked",
  "no-decision": "pending",
};

export function fixtureTopics(): TopicListItem[] {
  return getAllTopicFiles()
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort)
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      motion: t.motion,
      stances: t.stances,
      parElo: 1200,
      bestScore: TOPIC_BEST[t.slug] ?? null,
      status: TOPIC_STATUS[t.slug] ?? "open",
      locksFor: t.slug === "crash-arithmetic" ? 5 : null,
      isWeekly: t.slug === "opaque-benefit",
    }));
}

export const FIXTURE_MOTION =
  "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";

export const FIXTURE_ARGUMENT = `The Stoic case here is narrower than it first looks. Whether the model can explain itself is an external — it is a fact about the machine, not about the judgement of the people who chose to deploy it. What is up to us is the assent: did the people responsible look at the evidence and form a sound judgement about it?

If the evidence is strong, then withholding deployment because the mechanism is opaque is treating an external as though it were the thing that carried moral weight. Epictetus would say the mistake is in the assent, not the algorithm. A doctor who prescribes a drug whose mechanism is unknown but whose trials are sound has not acted badly; they have judged well about what was in front of them.

The objection worth taking seriously is that opacity makes later judgement impossible. If the system fails, nobody can say why, and the responsible party cannot correct their assent. That is a real cost. But it is a cost to future judgement, not a reason to treat present evidence as worthless.`;

export const FIXTURE_VERDICT: VerdictData = {
  rejected: false,
  score: 71,
  fidelity: 8.0,
  rigor: 6.5,
  engagement: 7.0,
  verdict_line: "A real Stoic argument that gives away more than it needs to at the end.",
  strongest_move:
    "Naming the assent as the thing that is up to us, and holding the line that the machine's opacity is an external. That is the Enchiridion's actual move, not a paraphrase of it.",
  weakest_move:
    "The doctor analogy does the work the argument should have done itself. An unknown mechanism with sound trials is not the same as a system nobody can interrogate after the fact, and the difference is the whole case.",
  a_stronger_version_would:
    "Say what a Stoic owes the people the system decides about. The argument treats responsibility as something the deployer discharges by judging well in advance; Chrysippus's cylinder says the shape of the thing you set rolling is yours too.",
  unanswered_objection: {
    school: "virtue-ethics",
    claim:
      "Practical wisdom is exercised in deliberation, and you cannot deliberate about a result you cannot interrogate.",
    why_it_stands:
      "The argument concedes that opacity makes later judgement impossible and then treats that as a cost to be absorbed. It never says what deliberation is supposed to consist of once the reasons are unavailable, which is what the objection is asking.",
  },
};
