import Link from "next/link";
import { WeeklyMotionLink } from "./WeeklyMotionLink";
import { CaseTicks } from "./CaseTicks";
import type { CaseState } from "@/lib/cases";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export interface TopicListItem {
  slug: string;
  title: string;
  motion: string;
  stances: Record<SchoolId, string>;
  parElo: number;
  bestScore: number | null;
  caseState?: CaseState;
}

// Reads whatever debate_topics actually has — empty until Arthur's content
// is seeded, no separate "still developing" stub to keep in sync by hand.
export function TopicList({
  topics,
  school,
  weeklySlug,
}: {
  topics: TopicListItem[];
  school: SchoolId | null;
  weeklySlug?: string | null;
}) {
  if (topics.length === 0) {
    return (
      <div>
        <p className="text-ink-mid text-sm max-w-[50ch]">
          Still developing — the motions are being written. Check back soon.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
          <Link
            href={school ? `/s/${school}` : "/quiz"}
            className="text-ink-mid hover:text-ink underline underline-offset-4"
          >
            {school ? `Read the case for ${SCHOOL_COLORS[school].name}` : "Take the quiz"}
          </Link>
          <Link href="/lessons" className="text-ink-mid hover:text-ink underline underline-offset-4">
            Read the lessons
          </Link>
        </div>
      </div>
    );
  }

  const weekly = weeklySlug ? topics.find((t) => t.slug === weeklySlug) ?? null : null;
  const rest = weekly ? topics.filter((t) => t.slug !== weekly.slug) : topics;
  const borderColor = school ? SCHOOL_COLORS[school].surface : "transparent";

  return (
    <div>
      {/* Six motions at once is a menu, and a menu is a decision. The week
          picks one; the other five stay reachable underneath for anyone who
          actually wants to choose. */}
      {weekly && (
        <div className="mb-10 border-b border-rule pb-10">
          <p className="eyebrow text-ink-soft mb-2">This week&apos;s motion</p>
          <p className="font-sans text-sm text-ink-mid mb-5">
            A new motion each week. Miss one and nothing happens.
          </p>
          <div className="border-l-2 pl-4" style={{ borderColor }}>
            <h3 className="font-serif text-xl font-medium">{weekly.title}</h3>
            <p className="mt-1 text-sm text-ink-mid">{weekly.motion}</p>
            {school && <p className="mt-2 text-sm text-ink">{weekly.stances[school]}</p>}
            <p className="mt-3 font-mono text-xs text-ink-soft">
              {weekly.bestScore != null ? `Best ${weekly.bestScore}` : "Not yet debated"} · Par ELO{" "}
              {Math.round(weekly.parElo)}
            </p>
            {weekly.caseState && (
              <div className="mt-3">
                <CaseTicks state={weekly.caseState} />
              </div>
            )}
          </div>
          <div className="mt-6">
            <WeeklyMotionLink
              slug={weekly.slug}
              className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85"
            >
              Defend your school
            </WeeklyMotionLink>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <>
          {weekly && <p className="eyebrow text-ink-soft mb-4">All motions</p>}
          <ul className="divide-y divide-rule">
            {rest.map((topic) => (
              <li key={topic.slug} className="py-6 first:pt-0">
                <Link href={`/debate/${topic.slug}`} className="block group">
                  <div className="border-l-2 pl-4" style={{ borderColor }}>
                    <h3 className="font-serif text-lg font-medium group-hover:underline underline-offset-4">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-mid">{topic.motion}</p>
                    {school && <p className="mt-2 text-sm text-ink">{topic.stances[school]}</p>}
                    <p className="mt-3 font-mono text-xs text-ink-soft">
                      {topic.bestScore != null ? `Best ${topic.bestScore}` : "Not yet debated"} ·
                      Par ELO {Math.round(topic.parElo)}
                    </p>
                    {topic.caseState && (
                      <div className="mt-3">
                        <CaseTicks state={topic.caseState} />
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
