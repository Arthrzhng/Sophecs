"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResultCard } from "@/components/card/ResultCard";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { ShareSheet } from "@/components/share/ShareSheet";
import { ChallengeButton } from "@/components/share/ChallengeButton";
import { PENDING_RESULT_KEY } from "@/components/quiz/QuizShell";
import { submitQuizResult } from "@/app/actions";
import { track } from "@/lib/analytics/client";
import { pickShareLineFrom } from "@/lib/share-line";
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
// sessionStorage while the insert happens in the background, then rewrites
// the URL to the real /r/[id] without navigating. If the insert fails, the
// card stays up and sharing falls back to /s/[school] instead of a dead
// /r/[id] link.
export function QuizResultClient({ schools }: { schools: Record<SchoolId, SchoolContent> }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingResult | null | undefined>(undefined);
  const [resultId, setResultId] = useState<string | null>(null);
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
      // replaceState, not router.replace: a real navigation would unmount
      // and re-render the card the user is already looking at, for a page
      // that shows them the same thing. This rewrites the address bar in
      // place, so a refresh or a shared link resolves to the server-rendered
      // /r/[id] while this render stays put. The history entry for
      // /quiz/result is overwritten rather than added to, so Back lands on
      // /quiz.
      window.history.replaceState(null, "", `/r/${result.id}`);
      setResultId(result.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pending) return null; // either loading or already redirecting to /quiz

  const school = schools[pending.primary];
  const shareLine = resultId ? pickShareLineFrom(school.share_lines, resultId) : null;

  return (
    <Page width="read">
      <p className="text-sm text-ink-soft">Your school</p>

      <div className="mt-4">
        <ResultCard
          school={pending.primary}
          oneLine={school.one_line}
          oneLineAttribution={school.one_line_attribution}
        />
      </div>

      {/* One line, not a spinner: the card is already on screen and
          finished, so an animation here would imply something about it is
          still missing. */}
      {!resultId && !failed && <p className="mt-6 text-sm text-ink-soft">Saving your result…</p>}

      {resultId && shareLine && (
        <div className="mt-6">
          <ShareSheet
            resultId={resultId}
            school={pending.primary}
            shareLine={shareLine.text}
            shareLineIndex={shareLine.index}
          />
        </div>
      )}

      {failed && (
        <div className="mt-6">
          <ErrorState
            title="Couldn't save this result."
            body="The card above is correct and the case for your school is below. What a save buys you is a link worth sharing, so try again in a moment if you want one."
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          />
        </div>
      )}

      {/*
        The reading content for this school, with its primary source cited.
        A result that hands you a label and nothing to read is a personality
        quiz; this is the first thing that makes it not one.
      */}
      <section className="mt-12 border-t border-rule pt-8">
        <p className="text-sm text-ink-soft">The case for your school</p>
        <h2 className="mt-1 font-serif text-lg font-medium text-ink">{school.name}</h2>
        <div className="prose-reading mt-5 text-ink">
          {school.read.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-soft">{school.one_line_attribution}</p>
        <p className="mt-4 text-sm">
          <TextLink href={`/s/${pending.primary}`}>
            What this school gets wrong
          </TextLink>
        </p>
      </section>

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="font-serif text-lg font-medium text-ink">Now defend it</h2>
        <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
          The quiz gives you a starting position. The rest of Sophecs is about
          holding it: take a motion, write a case, and get scored on how
          faithfully you argue from {school.name} — not on whether anyone agrees.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/debate"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-ink bg-ink px-5 text-sm font-medium text-paper hover:border-ink-mid hover:bg-ink-mid"
          >
            Take a motion
          </Link>
          {resultId && <ChallengeButton resultId={resultId} school={pending.primary} variant="secondary" />}
          <TextLink href="/lessons" className="text-sm">
            Read the lessons
          </TextLink>
        </div>
      </section>
    </Page>
  );
}
