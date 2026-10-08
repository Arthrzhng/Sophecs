"use client";

import { useState } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { PathNode, type PathNodeState } from "@/components/daily-path/PathNode";
import { ProgressBar } from "@/components/daily-path/ProgressBar";
import { FeedbackSheet } from "@/components/daily-path/FeedbackSheet";
import { Celebration } from "@/components/daily-path/Celebration";
import { StatTile } from "@/components/daily-path/StatTile";
import { TODAY_STEPS, TODAY_SHIFTS } from "@/lib/today-path";

// One real question, verbatim from content/micro/no-decision-before.md on
// the content branch. The sheet has to be shown in both states, and a
// made-up question would be the one piece of invented copy in the restyle.
const DEMO = {
  question: "What was the cylinder and the top meant to show?",
  options: [
    "That fate and responsibility fit: the push is outside, the shape is the thing's own.",
    "That nothing is fated, since the same push could have made the cylinder spin.",
    "That the push is what matters, since without it nothing would move at all.",
  ],
  answer: 0,
  right:
    "The same push makes one roll and the other spin. The push starts the motion; the thing's own nature gives it its shape.",
  wrong:
    "Chrysippus held that everything is fated and that we are still responsible. The image shows how: the push comes from outside, but the shape of the motion comes from the object.",
};

const LETTERS = ["A", "B", "C"];

export function InteractivePath() {
  const [done, setDone] = useState(2);

  return (
    <div>
      <ol className="flex list-none flex-col items-center gap-7 py-3">
        {TODAY_STEPS.map((step, i) => {
          const state: PathNodeState = i < done ? "done" : i === done ? "current" : "locked";
          return (
            <PathNode
              key={step.title}
              index={i}
              title={step.title}
              caption={step.caption}
              state={state}
              lockReason={i >= 2 ? "judging" : "order"}
              school="stoicism"
              shift={TODAY_SHIFTS[i]}
              onClick={() => setDone(i + 1)}
            />
          );
        })}
      </ol>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <ChunkyButton tone="paper" onClick={() => setDone((d) => Math.max(0, d - 1))}>
          Fewer done
        </ChunkyButton>
        <ChunkyButton tone="paper" onClick={() => setDone((d) => Math.min(6, d + 1))}>
          More done
        </ChunkyButton>
      </div>
    </div>
  );
}

export function InteractiveCheck() {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = picked === DEMO.answer;

  return (
    <div className="overflow-hidden rounded-panel border-2 border-rule bg-surface">
      <div className="p-6">
        <ProgressBar value={1} max={2} label="Question 1 of 2" />
        <p className="mt-6 text-lg font-extrabold leading-tight tracking-tight text-ink">
          {DEMO.question}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {DEMO.options.map((option, i) => {
            const isPicked = picked === i;
            const isAnswer = i === DEMO.answer;
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

        {/* Replaced by the sheet's own action once an answer is checked,
            rather than left sitting there greyed out beside it. */}
        {!checked && (
          <div className="mt-6">
            <ChunkyButton
              school="stoicism"
              disabled={picked === null}
              onClick={() => setChecked(true)}
            >
              Check
            </ChunkyButton>
          </div>
        )}
      </div>

      {checked && (
        <FeedbackSheet
          correct={correct}
          heading={correct ? "Exactly." : "Not quite."}
          body={correct ? DEMO.right : DEMO.wrong}
          extra={correct ? undefined : `The right answer: ${DEMO.options[DEMO.answer]}`}
          action={
            <ChunkyButton
              tone={correct ? "correct" : "wrong"}
              onClick={() => {
                setChecked(false);
                setPicked(null);
              }}
            >
              Next question
            </ChunkyButton>
          }
        />
      )}
    </div>
  );
}

export function CelebrationDemo() {
  const [shown, setShown] = useState(0);
  const headings = ["Both right.", "One of two.", "Worth another read."];
  const scores = [2, 1, 0];

  return (
    <div>
      <Celebration
        key={shown}
        heading={headings[shown]}
        tiles={
          <>
            <StatTile label="Reading check" value={`${scores[shown]}/2`} />
            <StatTile label="Notes written" value="2/2" />
          </>
        }
        note="Your notes will be waiting above the editor."
        action={<ChunkyButton school="stoicism">Argue the motion</ChunkyButton>}
        secondary={
          scores[shown] < 2 ? (
            <button
              type="button"
              className="min-h-11 text-sm text-ink-mid underline underline-offset-4"
            >
              Read the passage again
            </button>
          ) : undefined
        }
      />
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {headings.map((h, i) => (
          <ChunkyButton key={h} tone="paper" onClick={() => setShown(i)}>
            {scores[i]} right
          </ChunkyButton>
        ))}
      </div>
    </div>
  );
}
