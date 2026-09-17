"use client";

import { Button } from "@/components/ui/Button";
import type { QuizQuestion } from "../../../content/quiz/questions";

// The question, rendered identically on the landing page and on /quiz.
// That is the point: the step from landing to quiz is not a step. The
// visitor answers question one where they land, and question two is the
// same block on a different route.
//
// No card, no wrapping container. The rows sit directly on paper — the
// nesting the brief rules out is exactly what a bordered box around a list
// of bordered boxes produces.
export function QuestionBlock({
  question,
  index,
  total,
  selectedId,
  onSelect,
  onNext,
  onBack,
  nextLabel = "Next",
  immediate = false,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
  onNext: (optionId?: string) => void;
  onBack?: () => void;
  nextLabel?: string;
  /**
   * Selecting commits straight away and no buttons render. Used for
   * question one on the landing page, where there is nothing to go back to
   * and a Next button would push the third option below the fold on a small
   * phone. From question two on, Back and Next are both meaningful.
   */
  immediate?: boolean;
}) {
  const progress = index / total;

  return (
    <div>
      {/* Progress is a real sequence, so a counter is allowed here where a
          feature list would not get one. Plain words, not "01 / 10". */}
      <p className="text-sm text-ink-soft">
        {index + 1} of {total}
      </p>
      <div className="relative mt-2 h-px bg-rule" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 bg-ink"
          style={{ width: `${progress * 100}%`, height: "2px", top: "-0.5px" }}
        />
      </div>

      <fieldset className="mt-6">
        <legend className="font-serif text-lg font-medium text-ink">{question.prompt}</legend>

        <div className="mt-5 space-y-2">
          {question.options.map((option) => {
            const checked = selectedId === option.id;
            return (
              <label
                key={option.id}
                className={`flex w-full cursor-pointer items-start gap-3 rounded-control border bg-surface px-5 py-3.5 ${
                  checked ? "border-2 border-ink" : "border border-rule hover:border-rule-strong"
                }`}
                // Compensates for the 1px the border gains when selected, so
                // the row does not shift under the cursor.
                style={checked ? { paddingLeft: 19, paddingRight: 19 } : undefined}
              >
                <input
                  type="radio"
                  name={`q${question.id}`}
                  value={option.id}
                  checked={checked}
                  onChange={() => {
                    onSelect(option.id);
                    if (immediate) onNext(option.id);
                  }}
                  className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-ink"
                />
                {/* Serif at the base step: an answer is a sentence you read,
                    and the scale forbids serif below 16px. */}
                <span className="font-serif text-base leading-relaxed text-ink">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!immediate && (
        <div className="mt-6 flex items-center gap-3">
          {onBack && (
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          )}
          <Button onClick={() => onNext()} disabled={!selectedId}>
            {nextLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
