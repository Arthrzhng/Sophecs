"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QUIZ_OUTCOME_KEY } from "./quiz-flow";
import { ResultCard } from "./result-card";
import { ShareButton } from "./share-button";
import { schoolName } from "@/lib/schools";
import type { QuizOutcome } from "@/lib/quiz";

export function ResultView({
  excerpts,
}: {
  excerpts: Record<string, string>;
}) {
  const [outcome, setOutcome] = useState<QuizOutcome | null | undefined>(
    undefined
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUIZ_OUTCOME_KEY);
      setOutcome(raw ? (JSON.parse(raw) as QuizOutcome) : null);
    } catch {
      setOutcome(null);
    }
  }, []);

  if (outcome === undefined) return null;

  if (outcome === null) {
    return (
      <div className="max-w-[55ch]">
        <p className="eyebrow text-ink-soft mb-4">Result</p>
        <h1 className="font-serif text-3xl font-medium">
          No result to show yet.
        </h1>
        <p className="mt-4 text-ink-mid leading-relaxed">
          The diagnostic takes about two minutes and doesn&apos;t need an
          account.
        </p>
        <Link
          href="/quiz"
          className="mt-6 inline-block bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
        >
          Take the quiz
        </Link>
      </div>
    );
  }

  const school = outcome.assigned_school_id;

  return (
    <div>
      <p className="eyebrow text-ink-soft mb-4">Result</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-medium leading-tight">
        You argue like a {schoolName(school).toLowerCase()} does.
      </h1>

      <div className="mt-10">
        <ResultCard outcome={outcome} excerpt={excerpts[school] ?? ""} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/debate"
          className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
        >
          Defend your school
        </Link>
        <ShareButton />
        <Link
          href="/quiz"
          className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
        >
          Retake
        </Link>
      </div>

      <p className="mt-8 text-sm text-ink-mid max-w-[55ch] leading-relaxed">
        Sign up to attach this result to a profile, keep a rating, and enter
        the arena under your school&apos;s colours.{" "}
        <Link href="/auth" className="underline underline-offset-4 text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
