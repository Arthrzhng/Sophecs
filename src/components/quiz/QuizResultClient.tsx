"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResultCard } from "@/components/card/ResultCard";
import { PENDING_RESULT_KEY } from "@/components/quiz/QuizShell";
import { submitQuizResult } from "@/app/actions";
import { track } from "@/lib/analytics/client";
import type { SchoolContent } from "@/lib/schools";
import type { SchoolId, SchoolVector } from "@/lib/types";

interface PendingResult {
  primary: SchoolId;
  secondary: SchoolId;
  vector: SchoolVector;
  answers: { q: number; opt: string }[];
  durationMs: number;
  challengeId: string | null;
  // Carried from /auth/callback's /quiz?next= redirect. Not yet consumed —
  // /debate doesn't exist until 2b/2c, and redirecting a first-time quiz
  // taker to a "still developing" stub would be worse than showing the
  // normal result card. See docs/decisions.md.
  next: string | null;
  referrer: string;
}

// Transient — never linkable. Computes nothing itself (QuizShell already
// scored the quiz client-side); this renders the card immediately from
// sessionStorage while the insert happens in the background, then redirects
// to the real /r/[id]. If the insert fails, the card stays up and sharing
// falls back to /s/[school] instead of a dead /r/[id] link.
export function QuizResultClient({ schools }: { schools: Record<SchoolId, SchoolContent> }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingResult | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_RESULT_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      router.replace("/quiz");
      return;
    }
    const parsed = JSON.parse(raw) as PendingResult;
    setPending(parsed);

    submitQuizResult({
      primary: parsed.primary,
      secondary: parsed.secondary,
      vector: parsed.vector,
      answers: parsed.answers,
      challengeId: parsed.challengeId,
      referrer: parsed.referrer,
    }).then((result) => {
      if (!result.ok) {
        setFailed(true);
        return;
      }
      track({
        name: "quiz_completed",
        props: {
          school: parsed.primary,
          secondary: parsed.secondary,
          duration_ms: parsed.durationMs,
          result_id: result.id,
        },
      });
      if (parsed.challengeId && result.challengerSchool) {
        track({
          name: "challenge_accepted",
          props: {
            challenge_id: parsed.challengeId,
            challenger_school: result.challengerSchool,
            challengee_school: parsed.primary,
          },
        });
      }
      if (result.schoolChanged) {
        track({ name: "school_changed", props: result.schoolChanged });
      }
      try {
        sessionStorage.removeItem(PENDING_RESULT_KEY);
      } catch {
        // Non-fatal.
      }
      router.replace(`/r/${result.id}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pending) return null; // either loading or already redirecting to /quiz

  const school = schools[pending.primary];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-20">
        <p className="eyebrow text-ink-soft mb-5">Your result</p>
        <ResultCard
          school={pending.primary}
          oneLine={school.one_line}
          oneLineAttribution={school.one_line_attribution}
          vector={pending.vector}
        />
        {failed && (
          <p className="mt-6 text-sm text-ink-mid max-w-[50ch]">
            Couldn&apos;t save this result just now, but it&apos;s yours to keep looking at.{" "}
            <Link href={`/s/${pending.primary}`} className="underline underline-offset-4 text-ink">
              Read the case for {school.name}
            </Link>{" "}
            instead of sharing a link.
          </p>
        )}
      </div>
    </main>
  );
}
