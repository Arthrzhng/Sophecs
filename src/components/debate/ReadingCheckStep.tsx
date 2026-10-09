import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { FeedbackSheet } from "@/components/daily-path/FeedbackSheet";
import { LessonOverlay } from "./LessonOverlay";
import { ReadingCheckOption } from "./ReadingCheckOption";
import type { ReadingCheckQuestion } from "@/lib/lesson-chunks";
import type { SchoolId } from "@/lib/types";

/**
 * One question of the reading check, inside the player's chrome.
 *
 * Presentational: every piece of state arrives as a prop and every button
 * calls back out. That is what lets the styleguide stand four of these side
 * by side in their four states, while the route mounts one of them inside a
 * modal dialog — the thing being reviewed is then the screen itself rather
 * than a second drawing of it.
 *
 * It holds no refs and moves no focus either. Focus is the container's job,
 * because four of these on one page would otherwise fight over it on mount.
 */
export function ReadingCheckStep({
  question,
  index,
  total,
  picked,
  checked,
  school,
  onPick,
  onCheck,
  onAdvance,
  onLeave,
}: {
  question: ReadingCheckQuestion;
  /** 0-based. Decides the counter and whether this is the last question. */
  index: number;
  total: number;
  picked: number | null;
  /** True once the answer is in: the rows go read-only and the bar appears. */
  checked: boolean;
  school: SchoolId;
  onPick: (option: number) => void;
  onCheck: () => void;
  onAdvance: () => void;
  onLeave: () => void;
}) {
  const correct = picked === question.answer;
  const isLast = index === total - 1;

  return (
    <LessonOverlay
      // The track fills as each answer is checked rather than as each
      // question arrives, so it reflects what has been done, not where the
      // reader happens to be standing.
      value={index + (checked ? 1 : 0)}
      max={total}
      label={`Question ${index + 1} of ${total}`}
      onLeave={onLeave}
      bottom={
        checked ? (
          <FeedbackSheet
            correct={correct}
            heading={correct ? "Exactly." : "Not quite."}
            body={correct ? question.right : question.wrong}
            extra={
              correct ? undefined : `The right answer: ${question.options[question.answer]}`
            }
            action={
              <ChunkyButton tone={correct ? "correct" : "wrong"} onClick={onAdvance}>
                {isLast ? "See how you did" : "Next question"}
              </ChunkyButton>
            }
          />
        ) : undefined
      }
    >
      {/* Focusable for the container, which puts focus here on arriving and
          on every question after the first. The overlay is the screen while
          it is open, so the question is its h1. */}
      <h1
        tabIndex={-1}
        className="max-w-[28ch] text-lg font-extrabold leading-tight tracking-tight text-ink outline-none"
      >
        {question.question}
      </h1>

      <div role="group" aria-label="Answers" className="mt-6 flex flex-col gap-3">
        {question.options.map((option, i) => (
          <ReadingCheckOption
            key={option}
            index={i}
            option={option}
            picked={picked === i}
            isAnswer={i === question.answer}
            checked={checked}
            onPick={() => onPick(i)}
          />
        ))}
      </div>

      {/* Replaced by the feedback bar's own action once an answer is
          checked, rather than left sitting there greyed out beside it. */}
      {!checked && (
        <div className="mt-8">
          <ChunkyButton school={school} disabled={picked === null} onClick={onCheck}>
            Check
          </ChunkyButton>
        </div>
      )}
    </LessonOverlay>
  );
}
