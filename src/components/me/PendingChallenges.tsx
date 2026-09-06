import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { PendingChallenge } from "@/lib/challenge";

export function PendingChallenges({ challenges }: { challenges: PendingChallenge[] }) {
  if (challenges.length === 0) {
    return <p className="text-sm text-ink-soft">No pending challenges.</p>;
  }

  return (
    <ul className="space-y-3">
      {challenges.map((c) => (
        <li key={c.challengeId} className="flex items-center justify-between gap-4">
          <span className="text-sm">
            {c.otherSchool ? SCHOOL_COLORS[c.otherSchool].name : "Someone"} challenged you
          </span>
          {c.topicSlug ? (
            <Link
              href={`/debate/${c.topicSlug}?challenge=${c.challengeId}`}
              className="font-mono text-xs text-ink underline underline-offset-4"
            >
              Debate them
            </Link>
          ) : (
            <span className="font-mono text-xs text-ink-soft">Topic not set yet</span>
          )}
        </li>
      ))}
    </ul>
  );
}
