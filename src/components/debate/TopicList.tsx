import Link from "next/link";
import { CaseTicks } from "./CaseTicks";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { CaseState } from "@/lib/case-steps";
import type { SchoolId } from "@/lib/types";

/** What this reader can do with a motion right now. */
export type TopicStatus = "open" | "pending" | "judged" | "locked";

const STATUS_LABEL: Record<TopicStatus, string> = {
  open: "Open",
  pending: "Awaiting verdict",
  judged: "Judged",
  locked: "Locked for now",
};

export interface TopicListItem {
  slug: string;
  title: string;
  motion: string;
  stances: Record<SchoolId, string>;
  parElo: number;
  bestScore: number | null;
  status: TopicStatus;
  /** Days until a locked motion reopens. Null unless status is "locked". */
  locksFor?: number | null;
  isWeekly?: boolean;
  caseState?: CaseState;
}

// A list, not a grid. Each motion is a row: the motion on the left, the
// measured values on the right, and a hairline between. Six cards in a
// two-column grid is a menu of products; this is a reading list.
//
// The school colour appears once on this screen, on the week's motion, and
// nowhere else. It was previously a 2px rule on every row, which is the
// definition of using a tribal marker as a general UI accent.
//
// No filters. Six rows fit on one screen, and a control that narrows six
// things to four costs more attention than it saves; the status is on every
// row, which is what the filter was reading anyway. Past about a dozen
// motions the two native selects should come back.
export function TopicList({
  topics,
  school,
}: {
  topics: TopicListItem[];
  school: SchoolId | null;
}) {
  if (topics.length === 0) {
    return (
      <EmptyState
        title="No motions are open yet."
        body="The motions are still being written. Until one lands, the case for your school and the lessons are the useful things to read — an argument is easier to write when you have read the source it comes from."
        action={
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <TextLink href={school ? `/s/${school}` : "/quiz"}>
              {school ? `Read the case for ${SCHOOL_COLORS[school].name}` : "Take the quiz"}
            </TextLink>
            <TextLink href="/lessons">Read the lessons</TextLink>
          </div>
        }
      />
    );
  }

  // A column that holds the same number on every row is not a column. While
  // every motion is set at the same par, it is one sentence above the list;
  // the column comes back the moment a motion is set anywhere else.
  const par = topics[0].parElo;
  const uniformPar = topics.every((t) => t.parElo === par);
  const cols = uniformPar
    ? "md:grid-cols-[1fr_10rem_5rem]"
    : "md:grid-cols-[1fr_10rem_5rem_5rem]";

  return (
    <div>
      {uniformPar && (
        <p className="text-sm text-ink-mid">
          Every motion is set at par{" "}
          <span className="font-mono tabular text-ink">{Math.round(par)}</span>. Beating
          par raises your rating; falling short of it lowers it.
        </p>
      )}

      <div className="mt-6">
        {/* Column headers only where there are columns. Below md the row
            collapses to a definition list rather than scrolling. */}
        <div
          className={`hidden border-b border-rule pb-2 text-sm text-ink-soft md:grid md:gap-4 ${cols}`}
        >
          <span>Motion</span>
          <span>Status</span>
          <span className="text-right">Your best</span>
          {!uniformPar && <span className="text-right">Par ELO</span>}
        </div>

        <ul className="divide-y divide-rule">
          {topics.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={`/debate/${topic.slug}`}
                className={`group block py-6 md:grid md:gap-4 ${cols}`}
              >
                {/* The week's marker hangs into the gutter rather than
                    indenting its row. Indenting it put one title 18px in
                    from every other title, which is a ragged left edge on
                    the one column the eye reads down. The container has
                    24px of padding for it to hang in. */}
                <div
                  className={
                    topic.isWeekly && school ? "-ml-[18px] border-l-2 pl-4" : undefined
                  }
                  style={
                    topic.isWeekly && school
                      ? { borderColor: SCHOOL_COLORS[school].surface }
                      : undefined
                  }
                >
                  {topic.isWeekly && (
                    <p className="mb-1 text-sm text-ink-soft">This week&apos;s motion</p>
                  )}
                  <h3 className="font-serif text-md font-medium text-ink underline-offset-4 group-hover:underline">
                    {topic.title}
                  </h3>
                  <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
                    {topic.motion}
                  </p>
                  {school && (
                    <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink">
                      Your stance: {topic.stances[school]}
                    </p>
                  )}
                  {topic.caseState && (
                    <div className="mt-3">
                      <CaseTicks state={topic.caseState} />
                    </div>
                  )}
                </div>

                {/* Status is a word, not a pill, a dot or an icon. */}
                <p className="mt-3 text-sm text-ink-mid md:mt-0">
                  {topic.status === "locked" && topic.locksFor != null
                    ? `Locked for ${topic.locksFor} more ${topic.locksFor === 1 ? "day" : "days"}`
                    : STATUS_LABEL[topic.status]}
                </p>

                {/* Below md the measured values join the status as labelled
                    pairs, rather than a middle-dotted string to decode. */}
                <p className="mt-1 flex gap-6 text-sm text-ink-mid md:hidden">
                  <span>
                    <span className="font-mono tabular text-ink">
                      {topic.bestScore != null ? topic.bestScore : "—"}
                    </span>{" "}
                    best
                  </span>
                  {!uniformPar && (
                    <span>
                      <span className="font-mono tabular text-ink">
                        {Math.round(topic.parElo)}
                      </span>{" "}
                      par ELO
                    </span>
                  )}
                </p>
                <p className="hidden text-right font-mono text-sm tabular text-ink md:block">
                  {topic.bestScore != null ? topic.bestScore : "—"}
                </p>
                {!uniformPar && (
                  <p className="hidden text-right font-mono text-sm tabular text-ink md:block">
                    {Math.round(topic.parElo)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
