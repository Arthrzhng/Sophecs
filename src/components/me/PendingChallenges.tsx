import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { PendingChallenge } from "@/lib/challenge";

export function PendingChallenges({ challenges }: { challenges: PendingChallenge[] }) {
  if (challenges.length === 0) {
    return <p className="text-sm text-ink-mid">No pending challenges.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {challenges.map((c) => (
        <li
          key={c.challengeId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-rule bg-surface p-4"
        >
          <span className="text-sm text-ink">
            {c.otherSchool ? SCHOOL_COLORS[c.otherSchool].name : "Someone"} challenged you
          </span>
          {c.topicSlug ? (
            <Link
              href={`/debate/${c.topicSlug}?challenge=${c.challengeId}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
            >
              Debate them
            </Link>
          ) : (
            <span className="text-sm text-ink-soft">Topic not set yet</span>
          )}
        </li>
      ))}
    </ul>
  );
}
