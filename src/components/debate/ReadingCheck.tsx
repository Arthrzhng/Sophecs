"use client";

import { useEffect, useRef, useState } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { ProgressBar } from "@/components/daily-path/ProgressBar";
import { FeedbackSheet } from "@/components/daily-path/FeedbackSheet";
import {
  READING_CHECK_LENGTH,
  type ReadingCheckQuestion,
} from "@/lib/lesson-chunks";
import { loadPicks, savePicks, type Picks } from "@/lib/reading-check-progress";
import type { SchoolId } from "@/lib/types";

const LETTERS = ["A", "B", "C"];

/**
 * The graded check that follows the passage and the two typed notes.
 *
 * It gates nothing: a reader who gets both wrong goes on to argue exactly as
 * one who got both right does. What it produces is the score on the
 * celebration and the completion of path step 2.
 *
 * Picks are kept in browser storage rather than on the server
 * (docs/daily-path-copy.md §2), so coming back to a finished check shows the
 * score rather than asking the questions again.
 */
export function ReadingCheck({
  check,
  topicSlug,
  userId,
  school,
  onDone,
}: {
  check: ReadingCheckQuestion[];
  topicSlug: string;
  userId: string;
  school: SchoolId;
  /** Called with the final picks once the last question is acknowledged. */
  onDone: (picks: Picks) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [picks, setPicks] = useState<Picks>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore on mount only. Reading storage during render would differ
  // between the server pass and the first client pass and break hydration.
  useEffect(() => {
    setPicks(loadPicks(userId, topicSlug));
  }, [userId, topicSlug]);

  const question = check[index];
  const correct = picked === question.answer;
  const isLast = index === check.length - 1;

  function onCheck() {
    if (picked === null) return;
    const next = [...picks];
    next[index] = picked;
    setPicks(next);
    savePicks(userId, topicSlug, next);
    setChecked(true);
  }

  function advance() {
    if (isLast) {
      onDone(picks);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setChecked(false);
    // Move focus to the new question rather than leaving it on a button
    // that has just been replaced, which would drop a keyboard user back
    // to the top of the document.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <div data-daily-path>
      <p className="text-sm text-ink-mid">Check your reading</p>

      <ProgressBar
        className="mt-4"
        value={index + (checked ? 1 : 0)}
        max={READING_CHECK_LENGTH}
        label={`Question ${index + 1} of ${READING_CHECK_LENGTH}`}
      />

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 max-w-[28ch] text-xl font-extrabold leading-tight tracking-tight text-ink outline-none"
      >
        {question.question}
      </h1>

      <div role="group" aria-label="Answers" className="mt-6 flex flex-col gap-3">
        {question.options.map((option, i) => {
          const isPicked = picked === i;
          const isAnswer = i === question.answer;
          let ring = "border-rule-strong";
          let bg = "bg-surface";
          let dim = "";
          if (!checked && isPicked) {
            ring = "border-ink";
            bg = "bg-paper";
          }
          if (checked) {
            if (isAnswer) {
              ring = "border-[color:var(--color-correct)]";
              bg = "bg-[color:var(--color-correct-tint)]";
            } else if (isPicked) {
              ring = "border-[color:var(--color-wrong)]";
              bg = "bg-[color:var(--color-wrong-tint)]";
            } else {
              dim = "opacity-50";
            }
          }
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isPicked}
              disabled={checked}
              onClick={() => setPicked(i)}
              className={`chunky flex min-h-14 w-full items-center gap-4 rounded-chunky border-2 px-4 py-3 text-left text-base ${ring} ${bg} ${dim}`}
            >
              <span className="font-mono text-sm font-bold text-ink-mid">{LETTERS[i]}</span>
              <span className="text-ink">{option}</span>
            </button>
          );
        })}
      </div>

      {!checked && (
        <div className="mt-8">
          <ChunkyButton school={school} disabled={picked === null} onClick={onCheck}>
            Check
          </ChunkyButton>
        </div>
      )}

      {checked && (
        <div className="mt-8">
          <FeedbackSheet
            correct={correct}
            heading={correct ? "Exactly." : "Not quite."}
            body={correct ? question.right : question.wrong}
            extra={correct ? undefined : `The right answer: ${question.options[question.answer]}`}
            action={
              <ChunkyButton tone={correct ? "correct" : "wrong"} onClick={advance}>
                {isLast ? "See how you did" : "Next question"}
              </ChunkyButton>
            }
          />
        </div>
      )}
    </div>
  );
}
