"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { scoreQuiz } from "@/lib/quiz";
import type { QuizOption, QuizQuestion } from "@/lib/types";

export const QUIZ_OUTCOME_KEY = "sophecs.quiz.outcome";

export function QuizFlow({
  questions,
  options,
}: {
  questions: QuizQuestion[];
  options: QuizOption[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<QuizOption[]>([]);

  const question = questions[index];
  const questionOptions = options.filter(
    (option) => option.question_id === question.id
  );

  function choose(option: QuizOption) {
    const next = [...chosen, option];
    if (index + 1 < questions.length) {
      setChosen(next);
      setIndex(index + 1);
    } else {
      const outcome = scoreQuiz(next);
      try {
        sessionStorage.setItem(QUIZ_OUTCOME_KEY, JSON.stringify(outcome));
      } catch {
        // Private-mode storage failures fall through; the result page
        // handles a missing outcome by pointing back here.
      }
      router.push("/quiz/result");
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="eyebrow text-ink-soft">Diagnostic</span>
        <span className="font-mono text-xs text-ink-mid">
          {index + 1} / {questions.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={index}
        className="h-px bg-rule mb-12 relative"
      >
        <div
          className="absolute inset-y-0 left-0 bg-ink transition-all"
          style={{ width: `${(index / questions.length) * 100}%`, height: "2px", top: "-0.5px" }}
        />
      </div>

      <h1 className="font-serif text-2xl sm:text-[28px] font-medium leading-snug max-w-[63ch]">
        {question.prompt}
      </h1>

      <ul className="mt-10 space-y-3">
        {questionOptions.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => choose(option)}
              className="w-full text-left bg-surface border border-rule rounded-btn px-5 py-4 font-serif text-[17px] leading-relaxed hover:border-ink-soft active:bg-paper"
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-12 font-mono text-xs text-ink-soft">
        3 placeholder questions in the skeleton; the full diagnostic runs 10.
      </p>
    </div>
  );
}
