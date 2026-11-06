"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuizQuestionCard } from "./QuizQuestionCard";
import { SchoolMap, type MapSchool } from "@/components/phase3/SchoolMap";
import { meanPoint, rankSchools, scoreQuizV2, type MapPoint, type MapSchoolPosition, type QuizV2Option, type QuizV2Question } from "@/lib/quiz-v2-score";
import { track } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";

/**
 * Quiz v2, on a SIX_SCHOOLS build (docs/stage5-plan.md, step 4): the same
 * flow as QuizShell, with v2's ten questions and the two-axis map where v1
 * draws its triangle.
 *
 * Everything that names a school arrives as props from the server
 * (src/lib/quiz-v2.ts), so this module names none and is the same in every
 * build's bundle; only a SIX_SCHOOLS build renders it. Its progress and
 * its result use their own storage keys, so a v1 quiz in progress from
 * before a deploy is not read as v2 answers, or the other way round.
 */

export const SESSION_KEY_V2 = "sophecs.quiz.v2.progress";
export const PENDING_RESULT_KEY_V2 = "sophecs.quiz.v2.pending_result";

export interface QuizV2Props {
  questions: QuizV2Question[];
  schools: MapSchoolPosition[];
  mapSchools: MapSchool[];
  axes: { x: [string, string]; y: [string, string] };
}

export interface PendingResultV2 {
  version: 2;
  primary: SchoolId;
  secondary: SchoolId;
  point: MapPoint;
  answers: { q: number; opt: string }[];
  durationMs: number;
  challengeId: string | null;
  next: string | null;
  referrer: string;
}

type Source = "landing" | "school_page" | "challenge" | "direct";

interface State {
  index: number;
  chosenIds: (string | null)[];
}

type Action =
  | { type: "select"; optionId: string }
  | { type: "advance"; total: number }
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
      return { ...state, index: Math.min(state.index + 1, action.total) };
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

/**
 * The map beside a question: where the committed answers put the reader,
 * and where the selected one would move them. Shared with the landing
 * page's first question.
 */
export function QuizMapFigure({
  mapSchools,
  axes,
  chosenSoFar,
  selected,
  caption,
}: Pick<QuizV2Props, "mapSchools" | "axes"> & {
  chosenSoFar: QuizV2Option[];
  selected: QuizV2Option | null;
  caption?: string;
}) {
  const reader = meanPoint(chosenSoFar);
  const preview = selected ? meanPoint([...chosenSoFar, selected]) : undefined;
  return (
    <SchoolMap
      title="Where your answers put you, on the map of the schools"
      schools={mapSchools}
      axes={axes}
      reader={reader}
      preview={preview}
      caption={caption ?? (preview ? "Where this answer moves you" : undefined)}
    />
  );
}

/** The school the committed answers are nearest, for the Next button's colour; none before the first. */
export function nearestSoFar(chosenSoFar: QuizV2Option[], schools: MapSchoolPosition[]): SchoolId | undefined {
  if (chosenSoFar.length === 0) return undefined;
  return rankSchools(meanPoint(chosenSoFar), chosenSoFar[chosenSoFar.length - 1].vector, schools)[0] as SchoolId;
}

export function QuizShellV2({ questions, schools, mapSchools, axes }: QuizV2Props) {
  const router = useRouter();
  const total = questions.length;

  // Read after mount, as QuizShell does, so the first question is in the
  // static render.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const [state, dispatch] = useReducer(reducer, { index: 0, chosenIds: Array(total).fill(null) });
  const startedAtRef = useRef<number>(0);
  const questionStartedAtRef = useRef<number>(0);
  const referrerRef = useRef<string>("");

  useEffect(() => {
    let restored = false;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_V2);
      if (raw) {
        const saved = JSON.parse(raw) as State;
        const valid =
          saved.chosenIds?.length === total &&
          saved.index < total &&
          saved.chosenIds.every((id, i) => id === null || questions[i].options.some((o) => o.id === id));
        if (valid) {
          dispatch({ type: "restore", state: saved });
          restored = true;
        }
      }
    } catch {
      // Ignore malformed or blocked storage: start fresh.
    }
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    setChallengeId(c);
    setNextPath(params.get("next"));
    referrerRef.current = typeof document !== "undefined" ? document.referrer : "";
    startedAtRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    if (!restored) {
      track({ name: "quiz_started", props: { source: detectSource(c), challenge_id: c ?? undefined } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.index >= total) return;
    try {
      sessionStorage.setItem(SESSION_KEY_V2, JSON.stringify(state));
    } catch {
      // Best-effort only.
    }
  }, [state, total]);

  useEffect(() => {
    function onUnload() {
      if (state.index >= total) return;
      const payload = JSON.stringify({ name: "quiz_abandoned", props: { last_question: state.index } });
      navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }));
    }
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [state.index, total]);

  const optionFor = useCallback(
    (qIdx: number, optId: string | null) => questions[qIdx].options.find((o) => o.id === optId),
    [questions]
  );

  const finish = useCallback(
    (chosenIds: (string | null)[]) => {
      const chosen = chosenIds.map((optId, qIdx) => {
        const option = optionFor(qIdx, optId);
        if (!option) throw new Error(`Missing answer for question ${qIdx + 1}`);
        return option;
      });
      const { primary, secondary, point } = scoreQuizV2(chosen, schools);
      const pending: PendingResultV2 = {
        version: 2,
        primary: primary as SchoolId,
        secondary: secondary as SchoolId,
        point,
        answers: chosen.map((o, qIdx) => ({ q: questions[qIdx].id, opt: o.id })),
        durationMs: Date.now() - startedAtRef.current,
        challengeId,
        next: nextPath,
        referrer: referrerRef.current,
      };
      try {
        sessionStorage.removeItem(SESSION_KEY_V2);
        sessionStorage.setItem(PENDING_RESULT_KEY_V2, JSON.stringify(pending));
      } catch {
        // If storage is unavailable the result page sends the reader back to /quiz.
      }
      router.push("/quiz/result");
    },
    [router, challengeId, nextPath, optionFor, questions, schools]
  );

  function next() {
    const optionId = state.chosenIds[state.index];
    if (!optionId) return;
    track({
      name: "quiz_question_answered",
      props: { question: state.index + 1, option: optionId, ms_on_question: Date.now() - questionStartedAtRef.current },
    });
    questionStartedAtRef.current = Date.now();
    if (state.index + 1 >= total) {
      finish(state.chosenIds);
      return;
    }
    dispatch({ type: "advance", total });
  }

  if (state.index >= total) return null; // finishing: navigating away

  const question = questions[state.index];
  // Earlier answers only, as on v1's triangle: stepping back shows where
  // the reader stood then.
  const chosenSoFar = state.chosenIds
    .slice(0, state.index)
    .map((optId, qIdx) => optionFor(qIdx, optId))
    .filter((o): o is QuizV2Option => Boolean(o));
  const selected = optionFor(state.index, state.chosenIds[state.index]) ?? null;

  return (
    <div>
      {nextPath && state.index === 0 && (
        <p className="mb-6 text-sm text-ink-mid">Take the quiz first. Your school is your side.</p>
      )}
      <QuizQuestionCard
        question={question}
        index={state.index}
        total={total}
        selectedId={state.chosenIds[state.index]}
        chosenSoFar={[]}
        figure={<QuizMapFigure mapSchools={mapSchools} axes={axes} chosenSoFar={chosenSoFar} selected={selected} />}
        buttonSchool={nearestSoFar(chosenSoFar, schools)}
        onSelect={(optionId) => dispatch({ type: "select", optionId })}
        onNext={next}
        onBack={state.index > 0 ? () => dispatch({ type: "back" }) : undefined}
        nextLabel={state.index + 1 >= total ? "See your school" : "Next"}
      />
    </div>
  );
}
