"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Question } from "./Question";
import { QUIZ_QUESTIONS, type QuizOption } from "../../../content/quiz/questions";
import { scoreQuiz } from "@/lib/scoring";
import { track } from "@/lib/analytics/client";

const SESSION_KEY = "sophecs.quiz.progress";
export const PENDING_RESULT_KEY = "sophecs.quiz.pending_result";

type Source = "landing" | "school_page" | "challenge" | "direct";

interface State {
  index: number;
  chosenIds: (string | null)[];
}

type Action = { type: "answer"; optionId: string } | { type: "back" } | { type: "restore"; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answer": {
      const chosenIds = [...state.chosenIds];
      chosenIds[state.index] = action.optionId;
      return { index: Math.min(state.index + 1, QUIZ_QUESTIONS.length), chosenIds };
    }
    case "back":
      return { ...state, index: Math.max(0, state.index - 1) };
    case "restore":
      return action.state;
    default:
      return state;
  }
}

function detectSource(challengeId: string | null): Source {
  if (challengeId) return "challenge";
  if (typeof document === "undefined") return "direct";
  const ref = document.referrer;
  if (!ref) return "direct";
  try {
    const url = new URL(ref);
    if (url.origin !== window.location.origin) return "direct";
    if (url.pathname === "/") return "landing";
    if (url.pathname.startsWith("/s/")) return "school_page";
  } catch {
    return "direct";
  }
  return "direct";
}

export function QuizShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("c");

  const [state, dispatch] = useReducer(reducer, { index: 0, chosenIds: Array(QUIZ_QUESTIONS.length).fill(null) });
  const startedAtRef = useRef<number>(0);
  const questionStartedAtRef = useRef<number>(0);
  const referrerRef = useRef<string>("");

  // Restore from a discarded tab; bootstrap timers and quiz_started otherwise.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as State;
        if (saved.chosenIds?.length === QUIZ_QUESTIONS.length && saved.index < QUIZ_QUESTIONS.length) {
          dispatch({ type: "restore", state: saved });
        }
      }
    } catch {
      // Ignore malformed/blocked storage — start fresh.
    }
    referrerRef.current = typeof document !== "undefined" ? document.referrer : "";
    startedAtRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    track({
      name: "quiz_started",
      props: { source: detectSource(challengeId), challenge_id: challengeId ?? undefined },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.index >= QUIZ_QUESTIONS.length) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // Best-effort only.
    }
  }, [state]);

  // quiz_abandoned via sendBeacon on unload if the quiz never completed.
  useEffect(() => {
    function onUnload() {
      if (state.index >= QUIZ_QUESTIONS.length) return;
      const payload = JSON.stringify({
        name: "quiz_abandoned",
        props: { last_question: state.index },
      });
      navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }));
    }
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [state.index]);

  const finish = useCallback(
    (chosenIds: (string | null)[]) => {
      const chosen: QuizOption[] = chosenIds.map((optId, qIdx) => {
        const option = QUIZ_QUESTIONS[qIdx].options.find((o) => o.id === optId);
        if (!option) throw new Error(`Missing answer for question ${qIdx + 1}`);
        return option;
      });
      const { primary, secondary, vector } = scoreQuiz(chosen);
      const answers = chosen.map((option, qIdx) => ({ q: qIdx + 1, opt: option.id }));
      const durationMs = Date.now() - startedAtRef.current;

      try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.setItem(
          PENDING_RESULT_KEY,
          JSON.stringify({
            primary,
            secondary,
            vector,
            answers,
            durationMs,
            challengeId,
            referrer: referrerRef.current,
          })
        );
      } catch {
        // If storage is unavailable the result page will bounce back to /quiz.
      }
      router.push("/quiz/result");
    },
    [router, challengeId]
  );

  function choose(optionId: string) {
    const msOnQuestion = Date.now() - questionStartedAtRef.current;
    track({
      name: "quiz_question_answered",
      props: { question: state.index + 1, option: optionId, ms_on_question: msOnQuestion },
    });
    questionStartedAtRef.current = Date.now();

    const nextChosenIds = [...state.chosenIds];
    nextChosenIds[state.index] = optionId;

    if (state.index + 1 >= QUIZ_QUESTIONS.length) {
      finish(nextChosenIds);
      return;
    }
    dispatch({ type: "answer", optionId });
  }

  if (state.index >= QUIZ_QUESTIONS.length) return null; // finishing → navigating away

  const question = QUIZ_QUESTIONS[state.index];
  const progress = state.index / QUIZ_QUESTIONS.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {state.index > 0 ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "back" })}
            aria-label="Previous question"
            className="min-w-11 min-h-11 -ml-2 flex items-center justify-center text-ink-mid hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M11 3 5 9l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span />
        )}
        <span className="font-mono text-xs text-ink-mid">
          {state.index + 1} / {QUIZ_QUESTIONS.length}
        </span>
      </div>
      <div className="h-px bg-rule mb-12 relative">
        <div
          className="absolute inset-y-0 left-0 bg-ink"
          style={{ width: `${progress * 100}%`, height: "2px", top: "-0.5px" }}
        />
      </div>
      <Question question={question} onChoose={choose} />
    </div>
  );
}
