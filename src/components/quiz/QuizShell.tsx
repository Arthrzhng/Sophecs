"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionBlock } from "./QuestionBlock";
import { QUIZ_QUESTIONS, type QuizOption } from "../../../content/quiz/questions";
import { scoreQuiz } from "@/lib/scoring";
import { track } from "@/lib/analytics/client";

export const SESSION_KEY = "sophecs.quiz.progress";
export const PENDING_RESULT_KEY = "sophecs.quiz.pending_result";

type Source = "landing" | "school_page" | "challenge" | "direct";

interface State {
  index: number;
  chosenIds: (string | null)[];
}

type Action =
  | { type: "select"; optionId: string }
  | { type: "advance" }
  | { type: "back" }
  | { type: "restore"; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select": {
      const chosenIds = [...state.chosenIds];
      chosenIds[state.index] = action.optionId;
      return { ...state, chosenIds };
    }
    case "advance":
      return { ...state, index: Math.min(state.index + 1, QUIZ_QUESTIONS.length) };
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

  // Read from window.location after mount, not from useSearchParams during
  // render. useSearchParams opts the calling subtree out of the static
  // prerender, which meant /quiz shipped an empty <main> and the first
  // question only appeared once JS had hydrated: FCP 0.8 s, LCP 2.8 s, CLS
  // 0.1, all of it the gap between the two. Neither value affects what is
  // rendered — `c` is the challenge id for analytics and the pending
  // result, `next` is set by /auth/callback and threaded through the same
  // payload — so neither has any business blocking first paint.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const [state, dispatch] = useReducer(reducer, { index: 0, chosenIds: Array(QUIZ_QUESTIONS.length).fill(null) });
  const startedAtRef = useRef<number>(0);
  const questionStartedAtRef = useRef<number>(0);
  const referrerRef = useRef<string>("");

  // Restore from a discarded tab; bootstrap timers and quiz_started otherwise.
  useEffect(() => {
    let restored = false;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as State;
        if (saved.chosenIds?.length === QUIZ_QUESTIONS.length && saved.index < QUIZ_QUESTIONS.length) {
          dispatch({ type: "restore", state: saved });
          restored = true;
        }
      }
    } catch {
      // Ignore malformed/blocked storage — start fresh.
    }
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    const n = params.get("next");
    setChallengeId(c);
    setNextPath(n);

    referrerRef.current = typeof document !== "undefined" ? document.referrer : "";
    startedAtRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    // `c` from the parsed params rather than the state just set: state
    // updates are not visible until the next render, and this event has to
    // carry the challenge id it was started from.
    //
    // Skipped when progress was restored. Two cases restore: the visitor
    // answered question one on the landing page, which fired quiz_started
    // there, or they refreshed mid-quiz. Firing again in either case would
    // double-count a start that already happened.
    if (!restored) {
      track({
        name: "quiz_started",
        props: { source: detectSource(c), challenge_id: c ?? undefined },
      });
    }
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
            next: nextPath,
            referrer: referrerRef.current,
          })
        );
      } catch {
        // If storage is unavailable the result page will bounce back to /quiz.
      }
      router.push("/quiz/result");
    },
    [router, challengeId, nextPath]
  );

  // Selecting records the choice; Next commits it. The event fires on the
  // commit, so changing your mind before pressing Next does not emit two
  // answers for one question.
  function select(optionId: string) {
    dispatch({ type: "select", optionId });
  }

  function next() {
    const optionId = state.chosenIds[state.index];
    if (!optionId) return;

    const msOnQuestion = Date.now() - questionStartedAtRef.current;
    track({
      name: "quiz_question_answered",
      props: { question: state.index + 1, option: optionId, ms_on_question: msOnQuestion },
    });
    questionStartedAtRef.current = Date.now();

    if (state.index + 1 >= QUIZ_QUESTIONS.length) {
      finish(state.chosenIds);
      return;
    }
    dispatch({ type: "advance" });
  }

  if (state.index >= QUIZ_QUESTIONS.length) return null; // finishing → navigating away

  const question = QUIZ_QUESTIONS[state.index];
  const progress = state.index / QUIZ_QUESTIONS.length;

  return (
    <div>
      {nextPath && state.index === 0 && (
        <p className="mb-6 text-sm text-ink-mid">Take the quiz first. Your school is your side.</p>
      )}
      <QuestionBlock
        question={question}
        index={state.index}
        total={QUIZ_QUESTIONS.length}
        selectedId={state.chosenIds[state.index]}
        onSelect={select}
        onNext={next}
        onBack={state.index > 0 ? () => dispatch({ type: "back" }) : undefined}
        nextLabel={state.index + 1 >= QUIZ_QUESTIONS.length ? "See your school" : "Next"}
      />
    </div>
  );
}
