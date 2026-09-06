"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_ARGUMENT_WORDS, MAX_ARGUMENT_WORDS, WORD_COUNT_WARNING_AT, wordCount } from "@/lib/debate-limits";
import { track } from "@/lib/analytics/client";
import { SCHOOL_COLORS } from "@/lib/school-colors";
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
}

export function ArgumentEditor({
  topicSlug,
  motion,
  school,
  userId,
  challengeId,
}: {
  topicSlug: string;
  motion: string;
  school: SchoolId;
  userId: string;
  challengeId?: string;
}) {
  const router = useRouter();
  const draftKey = `draft:${topicSlug}:${userId}`;
  const [argument, setArgument] = useState("");
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
    track({
      name: "debate_submitted",
      props: { topic_slug: topicSlug, word_count: words, from_challenge: Boolean(challengeId) },
    });

    let response: JudgeResponse;
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSlug, argument, challengeId }),
      });
      response = await res.json();
    } catch {
      setStatus({ kind: "error", message: "Judging failed. Your argument is saved. Try again." });
      return;
    }

    if (response.paused) {
      track({ name: "judge_paused", props: { reason: response.reason as never } });
      setStatus({ kind: "paused", reason: response.reason ?? "unknown" });
      return;
    }

    if (!response.ok || !response.debateId) {
      setStatus({ kind: "error", message: response.error ?? "Judging failed. Your argument is saved. Try again." });
      return;
    }

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
    if (challengeId && response.challenge?.completed) {
      track({
        name: "challenge_completed",
        props: {
          challenge_id: challengeId,
          winner_school: (response.challenge.winnerSchool ?? "draw") as never,
        },
      });
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
        Defend the {SCHOOL_COLORS[school].name} position.
      </p>

      <textarea
        value={argument}
        onChange={(e) => setArgument(e.target.value)}
        rows={12}
        placeholder={`At least ${MIN_ARGUMENT_WORDS} words — enough room to actually argue the case, not just assert it.`}
        className="mt-6 w-full bg-surface border border-rule rounded-md p-4 font-serif text-base leading-relaxed placeholder:text-ink-soft placeholder:font-sans placeholder:text-sm resize-y"
      />

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`font-mono text-xs ${words >= WORD_COUNT_WARNING_AT ? "text-oxblood" : "text-ink-soft"}`}
        >
          {words} / {MAX_ARGUMENT_WORDS} words
        </span>
        {status.kind === "error" && (
          <span className="font-mono text-xs text-oxblood">{status.message}</span>
        )}
        {status.kind === "paused" && (
          <span className="font-mono text-xs text-ink-mid">
            Judging is paused. Your argument is saved and will be judged when it resumes.
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
          Submit for judgment
        </button>
      </div>
    </div>
  );
}
