"use client";

import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { SchoolTriangle } from "./SchoolTriangle";
import { scoreQuiz } from "@/lib/scoring";
import type { QuizOption, QuizQuestion } from "../../../content/quiz/questions";

const LETTERS = ["A", "B", "C", "D"];

/**
 * One quiz question in the Daily path design.
 *
 * This is the only question renderer. It replaced QuestionBlock on /quiz in
 * stage 3 and on the landing page in stage 7, which is what `immediate` is
 * for: the landing commits on the first tap, so the two routes share one
 * component and the step from landing to quiz stays invisible.
 *
 * The answer rows keep the radio-in-a-label semantics the old block had,
 * against the mockup's aria-pressed buttons. A single-choice question is
 * what a radio group is for: it arrow-keys between options and announces
 * itself under the legend, and swapping that for buttons would be a
 * regression dressed as a restyle.
 */
export function QuizQuestionCard({
  question,
  index,
  total,
  selectedId,
  chosenSoFar,
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
  /** The options committed on earlier questions, for the triangle. */
  chosenSoFar: QuizOption[];
  onSelect: (optionId: string) => void;
  /** Given the option id in `immediate` mode, where state has not settled. */
  onNext: (optionId?: string) => void;
  onBack?: () => void;
  nextLabel?: string;
  /**
   * Selecting commits straight away and no buttons render. Question one on
   * the landing page: there is nothing to go back to, and a Next button
   * makes the first tap of the product two taps.
   */
  immediate?: boolean;
}) {
  const selected = question.options.find((o) => o.id === selectedId) ?? null;
  const selectedIndex = question.options.findIndex((o) => o.id === selectedId);

  // Read through the real scorer rather than re-adding the vectors here,
  // so the picture can never disagree with the result it is previewing.
  const here = scoreQuiz(chosenSoFar);
  const preview = selected ? scoreQuiz([...chosenSoFar, selected]) : null;

  return (
    <div data-daily-path>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono tabular text-sm font-bold text-ink-mid">
          {index + 1} / {total}
        </p>
      </div>
      {/* No bar on the landing page: nothing is in flight there, and a
          10%-filled track is progress through something the visitor has
          not started. The "1 / 10" above it still says how long the quiz
          is, which is the part that earns its place. */}
      {!immediate && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-chunky bg-rule" aria-hidden="true">
          <div
            className="h-full bg-ink"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8 sm:mt-8 lg:flex-row lg:items-start">
        <fieldset className="min-w-0 flex-1 border-0 p-0">
          <legend className="text-sm text-ink-mid">Answer as you actually think</legend>
          {/* One step down below `sm` on the landing only, where the
              headline sits above the question and a 34px prompt costs the
              answer rows the fold. /quiz has nothing above it and keeps
              the size it was approved at. */}
          <p
            className={`mt-2 max-w-[28ch] font-extrabold leading-tight tracking-tight text-ink ${
              immediate ? "text-lg sm:text-xl" : "text-xl"
            }`}
          >
            {question.prompt}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {question.options.map((option, i) => {
              const checked = selectedId === option.id;
              return (
                <label
                  key={option.id}
                  className={`dp-option chunky grid min-h-16 cursor-pointer grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5 rounded-chunky border-2 px-4 py-3 ${
                    checked
                      ? "border-ink bg-paper"
                      : "border-rule-strong bg-surface"
                  }`}
                  style={{
                    ["--sh" as string]: checked
                      ? "var(--color-ink)"
                      : "var(--color-rule-strong)",
                  }}
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
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] border-2 text-sm font-extrabold ${
                      checked ? "border-ink text-ink" : "border-rule-strong text-ink-mid"
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="font-serif text-base leading-relaxed text-ink">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="w-full lg:max-w-xs">
          <SchoolTriangle
            vector={here.vector}
            previewVector={preview?.vector ?? null}
            primary={here.primary}
            secondary={here.secondary}
            neutral={chosenSoFar.length === 0}
            previewLetter={selectedIndex >= 0 ? LETTERS[selectedIndex] : null}
            caption={immediate ? "You start here" : null}
          />
        </div>
      </div>

      {!immediate && (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {onBack && (
            <ChunkyButton tone="paper" onClick={onBack}>
              Back
            </ChunkyButton>
          )}
          <ChunkyButton onClick={() => onNext()} disabled={!selectedId} school={here.primary}>
            {nextLabel}
          </ChunkyButton>
        </div>
      )}
    </div>
  );
}
