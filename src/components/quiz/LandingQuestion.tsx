"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionBlock } from "./QuestionBlock";
import { SESSION_KEY } from "./QuizShell";
import { track } from "@/lib/analytics/client";
import { QUIZ_QUESTIONS } from "../../../content/quiz/questions";

// Question one, live on the landing page.
//
// The visitor answers where they land rather than reading a description of
// the quiz and pressing a button to reach it. Answering writes the same
// sessionStorage shape QuizShell already restores from and navigates to
// /quiz, which picks up at question two — so there is one state machine,
// not two, and the landing is genuinely the first screen of the quiz rather
// than a copy of it.
//
// A client component, which does not stop the page being statically
// rendered; only a server component reading cookies would do that.
export function LandingQuestion() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const question = QUIZ_QUESTIONS[0];

  function next(optionId?: string) {
    const chosen = optionId ?? selectedId;
    if (!chosen) return;

    // quiz_started fires here rather than on /quiz, because this is where
    // the quiz started. QuizShell suppresses its own copy when it finds
    // restored progress, so the event still fires exactly once.
    track({ name: "quiz_started", props: { source: "landing" } });
    track({
      name: "quiz_question_answered",
      props: { question: 1, option: chosen, ms_on_question: 0 },
    });

    const chosenIds: (string | null)[] = Array(QUIZ_QUESTIONS.length).fill(null);
    chosenIds[0] = chosen;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ index: 1, chosenIds }));
    } catch {
      // Storage blocked: /quiz starts from question one. The answer is lost,
      // which is better than a dead button.
    }
    router.push("/quiz");
  }

  return (
    <QuestionBlock
      question={question}
      index={0}
      total={QUIZ_QUESTIONS.length}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onNext={next}
      immediate
    />
  );
}
