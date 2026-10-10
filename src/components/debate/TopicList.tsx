import Link from "next/link";
import { CaseTicks } from "./CaseTicks";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
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

/**
 * The six motions, one card each.
 *
 * Still a list and still one column. The earlier note here warned that six
 * cards in a two-column grid is a menu of products rather than a reading
 * list, and that still holds: what changed is the row, not the shape. A
 * motion is now a card you press, which is what every other list in the
 * restyle is, and the hairline between rows became the card's own edge.
 *
 * The school colour appears once on this screen, as the week's 4px left
 * edge, and nowhere else. Same device /s/[school] uses, for the same
 * reason: it says which school is being talked about without filling
 * anything.
 *
 * No filters. Six cards fit on one screen, and a control that narrows six
 * things to four costs more attention than it saves; the status is on every
 * card, which is what the filter was reading anyway. Past about a dozen
 * motions the two native selects should come back.
 */
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

  // A value that is the same on every card is not a value worth repeating.
  // While every motion is set at the same par it is one sentence above the
  // list; it moves onto the cards the moment a motion is set anywhere else.
  const par = topics[0].parElo;
  const uniformPar = topics.every((t) => t.parElo === par);

  return (
    <div>
      {uniformPar && (
        <p className="max-w-[60ch] text-sm leading-relaxed text-ink-mid">
          Every motion is set at par{" "}
          <span className="font-mono tabular font-bold text-ink">{Math.round(par)}</span>.
          Beating par raises your rating; falling short of it lowers it.
        </p>
      )}

      <ul className={`flex flex-col gap-4 ${uniformPar ? "mt-6" : ""}`}>
        {topics.map((topic) => {
          const weekly = Boolean(topic.isWeekly && school);
          return (
            <li key={topic.slug} className="flex">
              <Link
                href={`/debate/${topic.slug}`}
                className={`chunky group flex min-w-0 flex-1 flex-col rounded-panel border-2 border-rule-strong bg-surface p-5 ${
                  weekly ? "border-l-4" : ""
                }`}
                style={{
                  ...shade("var(--color-rule-strong)"),
                  ...(weekly && school
                    ? { borderLeftColor: SCHOOL_CHUNKY[school].bg }
                    : {}),
                }}
              >
                {topic.isWeekly && (
                  <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
                    This week&apos;s motion
                  </p>
                )}
                <h3
                  className={`font-serif text-md font-medium text-ink underline-offset-4 group-hover:underline ${
                    topic.isWeekly ? "mt-2" : ""
                  }`}
                >
                  {topic.title}
                </h3>
                <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
                  {topic.motion}
                </p>
                {school && (
                  <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink">
                    Your stance: {topic.stances[school]}
                  </p>
                )}
                {topic.caseState && (
                  <div className="mt-4">
                    <CaseTicks state={topic.caseState} />
                  </div>
                )}

                {/* The two measured things, on the card's own foot rather
                    than in columns beside it. A column that is empty on
                    five cards out of six was a column of dashes. */}
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t-2 border-rule pt-4">
                  {/* Status is a word, not a pill, a dot or an icon. */}
                  <p className="text-sm font-bold text-ink-mid">
                    {topic.status === "locked" && topic.locksFor != null
                      ? `Locked for ${topic.locksFor} more ${topic.locksFor === 1 ? "day" : "days"}`
                      : STATUS_LABEL[topic.status]}
                  </p>
                  <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-mid">
                    {topic.bestScore != null && (
                      <span>
                        Your best{" "}
                        <span className="font-mono tabular font-bold text-ink">
                          {topic.bestScore}
                        </span>
                      </span>
                    )}
                    {!uniformPar && (
                      <span>
                        Par{" "}
                        <span className="font-mono tabular font-bold text-ink">
                          {Math.round(topic.parElo)}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
