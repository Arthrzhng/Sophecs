"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CaseTicks } from "./CaseTicks";
import { Select } from "@/components/ui/Select";
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

const ALL = "all";

// A list, not a grid. Each row is a row: the motion on the left, three
// measured values on the right, and a hairline between. Six cards in a
// two-column grid is a menu of products; this is a reading list.
//
// The school colour appears once on this screen, on the week's motion, and
// nowhere else. It was previously a 2px rule on every row, which is the
// definition of using a tribal marker as a general UI accent.
export function TopicList({
  topics,
  school,
}: {
  topics: TopicListItem[];
  school: SchoolId | null;
}) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [scopeFilter, setScopeFilter] = useState<string>(ALL);

  const visible = useMemo(
    () =>
      topics.filter(
        (t) =>
          (statusFilter === ALL || t.status === statusFilter) &&
          (scopeFilter === ALL || (scopeFilter === "weekly" && t.isWeekly))
      ),
    [topics, statusFilter, scopeFilter]
  );

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

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <Select
          id="topic-scope"
          label="Showing"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          options={[
            { value: ALL, label: "All motions" },
            { value: "weekly", label: "This week only" },
          ]}
        />
        <Select
          id="topic-status"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: ALL, label: "Any status" },
            { value: "open", label: STATUS_LABEL.open },
            { value: "pending", label: STATUS_LABEL.pending },
            { value: "judged", label: STATUS_LABEL.judged },
            { value: "locked", label: STATUS_LABEL.locked },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing matches that."
            body="No motion on the list has that status yet. Widen the filter to see the rest."
            action={
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(ALL);
                  setScopeFilter(ALL);
                }}
                className="text-sm text-ink underline underline-offset-4 hover:text-ink-mid"
              >
                Show all motions
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-8">
          {/* Column headers only where there are columns. Below md the row
              collapses to a definition list rather than scrolling. */}
          <div className="hidden border-b border-rule pb-2 text-sm text-ink-soft md:grid md:grid-cols-[1fr_9rem_5rem_5rem] md:gap-4">
            <span>Motion</span>
            <span>Status</span>
            <span className="text-right">Your best</span>
            <span className="text-right">Par ELO</span>
          </div>

          <ul className="divide-y divide-rule">
            {visible.map((topic) => (
              <li key={topic.slug}>
                <Link
                  href={`/debate/${topic.slug}`}
                  className="group block py-6 md:grid md:grid-cols-[1fr_9rem_5rem_5rem] md:gap-4"
                >
                  <div
                    className={topic.isWeekly && school ? "border-l-2 pl-4" : undefined}
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

                  {/* One metadata line below md, three columns above it.
                      Status is a word, not a pill, a dot or an icon. */}
                  <p className="mt-3 text-sm text-ink-mid md:mt-0">
                    {topic.status === "locked" && topic.locksFor != null
                      ? `Locked for ${topic.locksFor} more ${topic.locksFor === 1 ? "day" : "days"}`
                      : STATUS_LABEL[topic.status]}
                  </p>
                  {/* Below md the two measured values join the status line
                      as a labelled pair each, rather than a middle-dotted
                      string that has to be decoded. */}
                  <p className="mt-1 flex gap-6 text-sm text-ink-mid md:hidden">
                    <span>
                      <span className="font-mono tabular text-ink">
                        {topic.bestScore != null ? topic.bestScore : "—"}
                      </span>{" "}
                      best
                    </span>
                    <span>
                      <span className="font-mono tabular text-ink">
                        {Math.round(topic.parElo)}
                      </span>{" "}
                      par ELO
                    </span>
                  </p>
                  <p className="hidden text-right font-mono text-sm tabular text-ink md:block">
                    {topic.bestScore != null ? topic.bestScore : "—"}
                  </p>
                  <p className="hidden text-right font-mono text-sm tabular text-ink md:block">
                    {Math.round(topic.parElo)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
