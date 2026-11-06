"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuizQuestionCard } from "./QuizQuestionCard";
import { QuizMapFigure, SESSION_KEY_V2, type QuizV2Props } from "./QuizShellV2";
import { track } from "@/lib/analytics/client";

/**
 * Quiz v2's question one on the landing page, on a SIX_SCHOOLS build: what
 * LandingQuestion is to v1. Answering writes the state QuizShellV2
 * restores from and goes to /quiz, which picks up at question two. The
 * map beside it puts the reader in the middle, where everyone starts.
 */
export function LandingQuestionV2({ questions, mapSchools, axes }: Pick<QuizV2Props, "questions" | "mapSchools" | "axes">) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const question = questions[0];

  function next(optionId?: string) {
    const chosen = optionId ?? selectedId;
    if (!chosen) return;
    track({ name: "quiz_started", props: { source: "landing" } });
    track({ name: "quiz_question_answered", props: { question: 1, option: chosen, ms_on_question: 0 } });
    const chosenIds: (string | null)[] = Array(questions.length).fill(null);
    chosenIds[0] = chosen;
    try {
      sessionStorage.setItem(SESSION_KEY_V2, JSON.stringify({ index: 1, chosenIds }));
    } catch {
      // Storage blocked: /quiz starts from question one.
    }
    router.push("/quiz");
  }

  return (
    <QuizQuestionCard
      question={question}
      index={0}
      total={questions.length}
      selectedId={selectedId}
      chosenSoFar={[]}
      figure={<QuizMapFigure mapSchools={mapSchools} axes={axes} chosenSoFar={[]} selected={null} caption="You start here" />}
      onSelect={setSelectedId}
      onNext={next}
      immediate
    />
  );
}
