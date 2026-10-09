"use client";

import { useState } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { PathNode, type PathNodeState } from "@/components/daily-path/PathNode";
import { ReadingCheckStep } from "@/components/debate/ReadingCheckStep";
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
  const [left, setLeft] = useState(false);

  // Framed at phone height instead of opened as a modal. The route mounts
  // this same step in a <dialog> that covers the viewport, which cannot be
  // put on a page beside eight other specimens; a box the size of a phone
  // shows the same three bands, and the X and the feedback bar land where
  // they land on the device.
  return (
    <div data-daily-path className="h-[32rem] overflow-hidden rounded-panel border-2 border-rule">
      {left ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
          <p className="text-sm text-ink-mid">
            The X and Escape both land on Today, with nothing recorded.
          </p>
          <ChunkyButton tone="paper" onClick={() => setLeft(false)}>
            Back to the check
          </ChunkyButton>
        </div>
      ) : (
        <ReadingCheckStep
          question={DEMO}
          index={0}
          total={2}
          picked={picked}
          checked={checked}
          school="stoicism"
          onPick={setPicked}
          onCheck={() => setChecked(true)}
          onAdvance={() => {
            setChecked(false);
            setPicked(null);
          }}
          onLeave={() => setLeft(true)}
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
