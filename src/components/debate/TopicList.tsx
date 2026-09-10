import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export interface TopicListItem {
  slug: string;
  title: string;
  motion: string;
  stances: Record<SchoolId, string>;
  parElo: number;
  bestScore: number | null;
}

// Reads whatever debate_topics actually has — empty until Arthur's content
// is seeded, no separate "still developing" stub to keep in sync by hand.
export function TopicList({
  topics,
  school,
}: {
  topics: TopicListItem[];
  school: SchoolId | null;
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

  return (
    <ul className="divide-y divide-rule">
      {topics.map((topic) => (
        <li key={topic.slug} className="py-6 first:pt-0">
          <Link href={`/debate/${topic.slug}`} className="block group">
            <div
              className="border-l-2 pl-4"
              style={{ borderColor: school ? SCHOOL_COLORS[school].surface : "transparent" }}
            >
              <h3 className="font-serif text-lg font-medium group-hover:underline underline-offset-4">
                {topic.title}
              </h3>
              <p className="mt-1 text-sm text-ink-mid">{topic.motion}</p>
              {school && <p className="mt-2 text-sm text-ink">{topic.stances[school]}</p>}
              <p className="mt-3 font-mono text-xs text-ink-soft">
                {topic.bestScore != null ? `Best ${topic.bestScore}` : "Not yet debated"} · Par
                ELO {Math.round(topic.parElo)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
