"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_ARGUMENT_WORDS, MAX_ARGUMENT_WORDS, WORD_COUNT_WARNING_AT, wordCount } from "@/lib/debate-limits";
import { track } from "@/lib/analytics/client";
import { SCHOOL_ADHERENT, SCHOOL_COLORS } from "@/lib/school-colors";
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
      setStatus({ kind: "error", message: "Judging failed. Your argument is saved. Try again." });
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
      setStatus({ kind: "error", message: response.error ?? "Judging failed. Your argument is saved. Try again." });
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
      <div className="py-20 text-center">
        <p className="text-ink-mid">Reading your argument.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-serif text-xl font-medium">{motion}</p>
      <p className="mt-2 font-sans text-sm text-ink-mid">
        {isRevision
          ? "Answer the objection inside your argument. Cut what no longer earns its place."
          : `Defend the ${SCHOOL_COLORS[school].name} position.`}
      </p>

      {/* Shown once, on the first argument a user ever writes. The step from
          an 80-second quiz to a written defence is the steepest in the
          product; three lines is the smallest thing that makes it a task
          rather than a blank page. The word limits are unchanged — this is
          scaffolding, not a different exercise. */}
      {showScaffold && (
        <ol className="mt-6 space-y-2 font-sans text-sm text-ink-mid max-w-[55ch] list-decimal pl-5">
          <li>State what a {SCHOOL_ADHERENT[school]} would say about this motion.</li>
          <li>
            Give the reason your school gives — the excerpt you just read is the one to use.
          </li>
          <li>Name the strongest objection and say why it doesn&apos;t win.</li>
        </ol>
      )}

      {/* The answers they wrote during the reading, quoted back. The whole
          reason for asking was to have something to point at here. */}
      {readingNotes.length > 0 && (
        <div className="mt-8 border-l-2 border-rule pl-4">
          <p className="eyebrow text-ink-soft mb-3">Your notes from the reading</p>
          <ul className="space-y-2">
            {readingNotes.map((note, i) => (
              <li key={i} className="font-serif text-base text-ink-mid leading-relaxed">
                &ldquo;{note}&rdquo;
              </li>
            ))}
          </ul>
          <p className="mt-3 font-sans text-sm text-ink-soft">
            You wrote these a minute ago. Use them.
          </p>
        </div>
      )}

      <textarea
        value={argument}
        onChange={(e) => setArgument(e.target.value)}
        rows={12}
        placeholder={
          showScaffold
            ? "Eighty words is enough for all three. Most first arguments take about ten minutes."
            : `At least ${MIN_ARGUMENT_WORDS} words — enough room to actually argue the case, not just assert it.`
        }
        className="mt-6 w-full bg-surface border border-rule rounded-md p-4 font-serif text-base leading-relaxed placeholder:text-ink-soft placeholder:font-sans placeholder:text-sm resize-y"
      />

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`font-mono text-xs ${words >= WORD_COUNT_WARNING_AT ? "text-error" : "text-ink-soft"}`}
        >
          {words} / {MAX_ARGUMENT_WORDS} words
        </span>
        {status.kind === "error" && (
          <span className="font-mono text-xs text-error">{status.message}</span>
        )}
        {status.kind === "paused" && (
          <span className="font-mono text-xs text-ink-mid">
            {status.reason === "already_revised"
              ? "You've already revised this argument. Start a new motion instead."
              : "Judging is paused. Your argument is saved and will be judged when it resumes."}
          </span>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="min-h-11 px-6 bg-ink text-surface rounded-md text-base font-medium hover:opacity-85 disabled:opacity-40"
        >
          {isRevision ? "Submit revision" : "Submit for judgment"}
        </button>
      </div>
    </div>
  );
}
