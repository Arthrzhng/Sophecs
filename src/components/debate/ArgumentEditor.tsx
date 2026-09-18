"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BeforeLesson } from "./BeforeLesson";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/ui/ErrorState";
import { TextLink } from "@/components/ui/TextLink";
import {
  MIN_ARGUMENT_WORDS,
  MAX_ARGUMENT_WORDS,
  TOPIC_LOCK_DAYS,
  WORD_COUNT_WARNING_AT,
  wordCount,
} from "@/lib/debate-limits";
import { track } from "@/lib/analytics/client";
import { SCHOOL_ADHERENT, SCHOOL_COLORS } from "@/lib/school-colors";
import type { MicroLessonContent } from "@/lib/lesson-chunks";
import type { SchoolId } from "@/lib/types";

type Status =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "paused"; reason: string }
  | { kind: "error"; message: string };

interface JudgeResponse {
  ok: boolean;
  debateId?: string;
  paused?: boolean;
  reason?: string;
  error?: string;
  eloDelta?: number;
  eloAfter?: number;
  streak?: { value: number; change: "extended" | "reset" | "unchanged" } | null;
  challenge?: { completed: boolean; winnerSchool?: string } | null;
  revision?: {
    parentDebateId: string;
    objectionAnswered: boolean;
    scoreDelta: number;
    fidelityDelta: number;
    daysOpen: number;
  } | null;
}

// What each pause reason means, said as a fact with something to do about
// it. "Judging is paused" on its own tells the reader nothing about whether
// their four hundred words survived.
const PAUSE_COPY: Record<string, { title: string; body: string }> = {
  kill_switch: {
    title: "Judging is paused.",
    body: "Your argument is saved and will be judged when judging resumes. Nothing you wrote is lost.",
  },
  budget: {
    title: "Judging is paused for today.",
    body: "The judge has a daily spending limit and it has been reached. Your argument is saved and will be judged when the limit resets.",
  },
  daily_cap: {
    title: "That is your last argument for today.",
    body: "There is a cap on how many arguments one person can send the judge in a day. This one is saved; come back tomorrow and it goes through.",
  },
  topic_lock: {
    title: "You have already argued this motion.",
    body: `A motion locks for ${TOPIC_LOCK_DAYS} days after a judged argument, so the second attempt is a fresh case rather than a rewrite. Take a different motion in the meantime.`,
  },
  already_revised: {
    title: "This argument has already been revised.",
    body: "One revision per argument. The objection the judge left standing is worth carrying into your next motion instead.",
  },
};

function pauseCopy(reason: string) {
  return (
    PAUSE_COPY[reason] ?? {
      title: "Judging is paused.",
      body: "Your argument is saved and will be judged when judging resumes.",
    }
  );
}

export function ArgumentEditor({
  topicSlug,
  motion,
  school,
  userId,
  challengeId,
  isAllowlisted,
  mode = "original",
  parentDebateId,
  initialArgument,
  isFirstArgument,
  microBefore,
  readingNotes = [],
}: {
  topicSlug: string;
  motion: string;
  school: SchoolId;
  userId: string;
  challengeId?: string;
  isAllowlisted?: boolean;
  mode?: "original" | "revision";
  parentDebateId?: string;
  initialArgument?: string;
  isFirstArgument?: boolean;
  /** The before-lesson, rendered inline as a disclosure. Null on a revision. */
  microBefore?: MicroLessonContent | null;
  readingNotes?: string[];
}) {
  const router = useRouter();
  const isRevision = mode === "revision";
  // A revision is never anyone's first argument — its parent is judged by
  // definition — so the scaffold is gated on both.
  const showScaffold = Boolean(isFirstArgument) && !isRevision;
  const draftKey = isRevision
    ? `draft:revision:${parentDebateId}:${userId}`
    : `draft:${topicSlug}:${userId}`;
  const [argument, setArgument] = useState(isRevision ? initialArgument ?? "" : "");
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [confirming, setConfirming] = useState(false);
  const restoredRef = useRef(false);

  // Restore a draft from a discarded tab or a sign-in round trip, then
  // autosave every 2 seconds while editing.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setArgument(saved);
        restoredRef.current = true;
        track({
          name: "draft_restored",
          props: { topic_slug: topicSlug, word_count: wordCount(saved) },
        });
      }
    } catch {
      // Best-effort only.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showScaffold) {
      track({ name: "first_argument_scaffold_shown", props: { topic_slug: topicSlug } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        if (argument) localStorage.setItem(draftKey, argument);
      } catch {
        // Best-effort only.
      }
    }, 2000);
    return () => clearInterval(id);
  }, [argument, draftKey]);

  const words = wordCount(argument);
  const canSubmit =
    words >= MIN_ARGUMENT_WORDS && words <= MAX_ARGUMENT_WORDS && status.kind !== "submitting";

  async function submit() {
    setConfirming(false);
    setStatus({ kind: "submitting" });
    // No analytics for an allowlisted reviewer's own judge calls — the
    // pre-launch review pass shouldn't pollute the real usage funnels.
    if (!isAllowlisted) {
      if (isRevision) {
        track({
          name: "revision_submitted",
          props: {
            debate_id: parentDebateId ?? "",
            parent_debate_id: parentDebateId ?? "",
            word_count: words,
          },
        });
      } else {
        track({
          name: "debate_submitted",
          props: { topic_slug: topicSlug, word_count: words, from_challenge: Boolean(challengeId) },
        });
      }
    }

    let response: JudgeResponse;
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicSlug,
          argument,
          challengeId: isRevision ? undefined : challengeId,
          parentDebateId: isRevision ? parentDebateId : undefined,
        }),
      });
      response = await res.json();
    } catch {
      setStatus({ kind: "error", message: "The judge could not be reached." });
      return;
    }

    if (response.paused) {
      if (!isAllowlisted) {
        track({ name: "judge_paused", props: { reason: response.reason as never } });
      }
      setStatus({ kind: "paused", reason: response.reason ?? "unknown" });
      return;
    }

    if (!response.ok || !response.debateId) {
      setStatus({ kind: "error", message: response.error ?? "The judge could not be reached." });
      return;
    }

    if (!isAllowlisted) {
      if (response.eloDelta != null && response.eloAfter != null) {
        track({
          name: "elo_changed",
          props: { delta: response.eloDelta, elo_after: response.eloAfter, mode: challengeId ? "pair" : "solo" },
        });
      }
      if (response.streak && response.streak.change !== "unchanged") {
        track(
          response.streak.change === "extended"
            ? { name: "streak_extended", props: { streak: response.streak.value } }
            : { name: "streak_reset", props: { previous: response.streak.value } }
        );
      }
      if (response.revision) {
        track({
          name: "revision_judged",
          props: {
            debate_id: response.debateId,
            objection_answered: response.revision.objectionAnswered,
            score_delta: response.revision.scoreDelta,
            fidelity_delta: response.revision.fidelityDelta,
          },
        });
        // A judged revision ends the case whether or not it answered the
        // objection — there is no third attempt — so this fires on both.
        track({ name: "case_closed", props: { topic_slug: topicSlug } });
        // Resolved means the objection no longer stands — a revision that
        // failed to answer it leaves it open, so no event.
        if (response.revision.objectionAnswered) {
          track({
            name: "objection_resolved",
            props: {
              parent_debate_id: response.revision.parentDebateId,
              days_open: response.revision.daysOpen,
            },
          });
        }
      }
      if (challengeId && response.challenge?.completed) {
        track({
          name: "challenge_completed",
          props: {
            challenge_id: challengeId,
            winner_school: (response.challenge.winnerSchool ?? "draw") as never,
          },
        });
      }
    }

    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Non-fatal.
    }
    router.push(`/debate/${topicSlug}/${response.debateId}?first=1`);
  }

  if (status.kind === "submitting") {
    return (
      <div className="border-t border-rule py-16">
        <p className="font-serif text-md text-ink">The judge is reading your argument.</p>
        <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
          It takes about half a minute. Leaving this page cancels nothing — the
          verdict will be on your profile either way.
        </p>
      </div>
    );
  }

  if (status.kind === "paused") {
    const copy = pauseCopy(status.reason);
    return (
      <div className="mt-8">
        <ErrorState
          title={copy.title}
          body={copy.body}
          action={
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <TextLink href="/debate">Back to the motions</TextLink>
              <TextLink href="/lessons">Read the lessons</TextLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-soft">{isRevision ? "Revision" : "Motion"}</p>
      <h1 className="mt-1 max-w-[60ch] font-serif text-lg font-medium leading-snug text-ink">
        {motion}
      </h1>

      {/* The only school colour on this screen. */}
      <p
        className="mt-5 border-l-2 pl-4 text-sm leading-relaxed text-ink-mid"
        style={{ borderColor: SCHOOL_COLORS[school].surface }}
      >
        {isRevision
          ? "Answer the objection inside your argument. Cut what no longer earns its place."
          : `You argue this as a ${SCHOOL_ADHERENT[school]}.`}
      </p>

      {microBefore && (
        <div className="mt-8">
          <BeforeLesson lesson={microBefore} />
        </div>
      )}

      {/* Shown once, on the first argument a user ever writes. The step from
          an 80-second quiz to a written defence is the steepest in the
          product; three lines is the smallest thing that makes it a task
          rather than a blank page. The word limits are unchanged — this is
          scaffolding, not a different exercise. */}
      {showScaffold && (
        <ol className="mt-8 max-w-[55ch] list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-mid">
          <li>State what a {SCHOOL_ADHERENT[school]} would say about this motion.</li>
          {/* The excerpt is keyed to the motion, not to the school: the
              Stoic and the Utilitarian arguing this motion read the same
              one. It sets up the question; the reason belongs to the
              school, and the case is where that reason is written down. */}
          <li>
            Give the reason your school gives. The excerpt above sets up the
            question, not your answer to it — your reason comes from{" "}
            <TextLink href={`/s/${school}`}>
              the case for {SCHOOL_COLORS[school].name}
            </TextLink>
            .
          </li>
          <li>Name the strongest objection and say why it doesn&apos;t win.</li>
        </ol>
      )}

      {/* The answers they wrote during the reading, quoted back. The whole
          reason for asking was to have something to point at here. */}
      {readingNotes.length > 0 && (
        <div className="mt-8 border-l-2 border-rule pl-4">
          <p className="mb-3 text-sm text-ink-soft">Your notes from the reading</p>
          <ul className="space-y-2">
            {readingNotes.map((note, i) => (
              <li key={i} className="font-serif text-base leading-relaxed text-ink-mid">
                &ldquo;{note}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Textarea
          id="argument"
          label="Your argument"
          serif
          rows={12}
          value={argument}
          onChange={(e) => setArgument(e.target.value)}
          count={`${words} / ${MAX_ARGUMENT_WORDS} words`}
          countOverLimit={words >= WORD_COUNT_WARNING_AT}
          placeholder={
            showScaffold
              ? "Eighty words is enough for all three. Most first arguments take about ten minutes."
              : `At least ${MIN_ARGUMENT_WORDS} words — enough room to actually argue the case, not just assert it.`
          }
        />
      </div>

      {status.kind === "error" && (
        <div className="mt-6">
          <ErrorState
            title="The judge could not be reached."
            body="Your argument is saved in this browser, so nothing is lost. Try again in a moment."
            detail={status.message}
            action={<Button variant="secondary" onClick={() => setConfirming(true)}>Try again</Button>}
          />
        </div>
      )}

      <div className="mt-6">
        <Button onClick={() => setConfirming(true)} disabled={!canSubmit}>
          {isRevision ? "Submit revision" : "Submit argument"}
        </Button>
        {words < MIN_ARGUMENT_WORDS && (
          <p className="mt-3 text-sm text-ink-soft">
            {MIN_ARGUMENT_WORDS - words} more{" "}
            {MIN_ARGUMENT_WORDS - words === 1 ? "word" : "words"} before you can submit.
          </p>
        )}
      </div>

      {/* Says what actually happens, in the order it happens, with no
          reassurance. Submitting is the one irreversible step in the
          product: it spends a judge call and locks the motion. */}
      <Dialog
        open={confirming}
        title={isRevision ? "Submit this revision?" : "Submit this argument?"}
        description={
          isRevision
            ? "It goes to the judge now. A revision is the last word on this argument — there is no second one."
            : `It goes to the judge now. You get one verdict and one revision. This motion locks for ${TOPIC_LOCK_DAYS} days afterwards.`
        }
        confirmLabel={isRevision ? "Submit revision" : "Submit argument"}
        cancelLabel="Keep editing"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
