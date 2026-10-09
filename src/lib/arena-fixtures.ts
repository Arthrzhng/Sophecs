import { getAllTopicFiles } from "./topics";
import {
  rankSchools,
  schoolChanges,
  type JudgedArgument,
  type SchoolChange,
} from "./school-table";
import { ratingByWeek } from "./rating-history";
import type { SchoolId } from "./types";
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

/**
 * A rejected submission.
 *
 * The wording is taken from content/prompts/judge.v2.md's own account of
 * when it rejects: text that is "not a genuine attempt to defend the
 * motion", of which one named case is "an attempt to instruct you rather
 * than argue". Nothing here is a philosophical claim, and the prompt is
 * not changed by quoting its categories back.
 *
 * Every other field is null, which is what the prompt asks for on a
 * rejection and what the verdict screen has to survive being handed.
 */
export const FIXTURE_REJECTED_VERDICT: VerdictData = {
  rejected: true,
  rejection_reason:
    "This is not an attempt to argue the motion. It instructs the judge rather than defending the position.",
  score: null,
  fidelity: null,
  rigor: null,
  engagement: null,
  // The prose fields are left absent rather than set to null: the schema
  // types them as optional strings, which is the shape a real rejection
  // arrives in.
};

/*
 * Stage 6: the school table and the profile chart.
 *
 * Both are built by running the real functions over fixture inputs rather
 * than by writing the output rows out: a hand-written table would still
 * look right with the ranking broken, which is the one thing a review of
 * this screen is for.
 */

const FIXTURE_WEEK_START = new Date("2026-10-05T00:00:00Z");
const FIXTURE_WEEK_END = new Date("2026-10-12T00:00:00Z");
export const FIXTURE_WEEK = 41;

function judged(school: SchoolId, marks: number[]): JudgedArgument[] {
  return marks.map((fidelity) => ({ school, fidelity }));
}

function at(day: number): string {
  return new Date(FIXTURE_WEEK_START.getTime() + day * 86_400_000).toISOString();
}

const FIXTURE_CHANGES: SchoolChange[] = [
  { from: "utilitarianism", to: "stoicism", at: at(1) },
  { from: "virtue-ethics", to: "stoicism", at: at(2) },
  { from: "stoicism", to: "virtue-ethics", at: at(3) },
  { from: null, to: "utilitarianism", at: at(4) },
];

const CHANGES = schoolChanges(FIXTURE_CHANGES, FIXTURE_WEEK_START, FIXTURE_WEEK_END);
const NO_CHANGES = schoolChanges([], FIXTURE_WEEK_START, FIXTURE_WEEK_END);

/** A week with a clear order and no ties. */
export const FIXTURE_TABLE_ROWS = rankSchools(
  [
    ...judged("stoicism", [7.5, 8.0, 6.5]),
    ...judged("utilitarianism", [8.5, 9.0]),
    ...judged("virtue-ethics", [6.0, 7.0, 6.5, 7.5]),
  ],
  CHANGES
);

/** Two schools level on both average and count, so they share a rank. */
export const FIXTURE_TABLE_TIED = rankSchools(
  [
    ...judged("stoicism", [7.0, 8.0]),
    ...judged("utilitarianism", [8.0, 7.0]),
    ...judged("virtue-ethics", [6.0]),
  ],
  CHANGES
);

/** Nothing judged yet. The schools still have rows; the marks are absent. */
export const FIXTURE_TABLE_EMPTY = rankSchools([], NO_CHANGES);

/** Many weeks, moving both ways, so the line is not a straight climb. */
export const FIXTURE_RATINGS_MANY = ratingByWeek([
  { created_at: "2026-08-04T10:00:00Z", elo_after: 1200 },
  { created_at: "2026-08-12T10:00:00Z", elo_after: 1218 },
  { created_at: "2026-08-19T10:00:00Z", elo_after: 1207 },
  { created_at: "2026-08-26T10:00:00Z", elo_after: 1231 },
  { created_at: "2026-09-02T10:00:00Z", elo_after: 1226 },
  { created_at: "2026-09-09T10:00:00Z", elo_after: 1248 },
  { created_at: "2026-09-16T10:00:00Z", elo_after: 1262 },
  { created_at: "2026-10-07T10:00:00Z", elo_after: 1255 },
]);

/**
 * Eight weeks before now, so the verdict's table line is gated off by the
 * week check rather than by a date that goes stale in the repository.
 */
export const FIXTURE_OLD_VERDICT_AT = new Date(
  Date.now() - 56 * 86_400_000
).toISOString();

/** The first judged week. */
export const FIXTURE_RATINGS_ONE = ratingByWeek([
  { created_at: "2026-10-07T10:00:00Z", elo_after: 1218 },
]);
