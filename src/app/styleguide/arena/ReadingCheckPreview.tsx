"use client";

import { useEffect, useRef, useState } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { ReadingCheck } from "@/components/debate/ReadingCheck";
import { revealMark } from "@/components/debate/LessonOverlay";
import { ReadingCheckStep } from "@/components/debate/ReadingCheckStep";
import { readingCheckScore, type ReadingCheckQuestion } from "@/lib/lesson-chunks";
import type { Picks } from "@/lib/reading-check-progress";
import type { SchoolId } from "@/lib/types";

const noop = () => {};

/**
 * One state of the lesson player, framed at roughly phone proportions.
 *
 * The route opens the step as a modal dialog filling the viewport, and only
 * one modal can be open at a time, so the four states cannot be looked at
 * together that way. Framed, they can: the step is the same component, the
 * chrome is the same chrome, and the frame stands in for the viewport.
 */
export function ReadingCheckFrame({
  question,
  index,
  total,
  picked,
  checked,
  school,
}: {
  question: ReadingCheckQuestion;
  index: number;
  total: number;
  picked: number | null;
  checked: boolean;
  school: SchoolId;
}) {
  const frame = useRef<HTMLDivElement>(null);

  // The same nudge the route makes once an answer is checked. Without it a
  // frame showing a checked state would hide the mark that is the point of
  // the state, since the feedback bar has taken the room it was in.
  useEffect(() => {
    if (checked) revealMark(frame.current);
  }, [checked]);

  return (
    <div
      ref={frame}
      className="h-[32rem] overflow-hidden rounded-panel border-2 border-rule"
    >
      <ReadingCheckStep
        question={question}
        index={index}
        total={total}
        picked={picked}
        checked={checked}
        school={school}
        onPick={noop}
        onCheck={noop}
        onAdvance={noop}
        onLeave={noop}
      />
    </div>
  );
}

/**
 * The real thing, opened for real.
 *
 * The frames above cannot show what the overlay is for: covering the site
 * header, trapping Tab inside itself, and answering Escape. This opens the
 * component the route opens, with the route's own fixtures, so all three can
 * be checked. Leaving reports where the route would have sent the reader
 * instead of navigating, since there is nothing to come back to from here.
 */
export function LiveReadingCheck({
  check,
  school,
}: {
  check: ReadingCheckQuestion[];
  school: SchoolId;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <div>
      <ChunkyButton
        school={school}
        onClick={() => {
          setOutcome(null);
          setOpen(true);
        }}
      >
        Check your reading
      </ChunkyButton>

      {outcome && <p className="mt-4 text-sm text-ink-mid">{outcome}</p>}

      {open && (
        <ReadingCheck
          check={check}
          topicSlug="preview-opaque-benefit"
          userId="preview"
          school={school}
          onLeave={() => {
            setOpen(false);
            setOutcome("Left the check. The route goes to /today and stores nothing.");
          }}
          onDone={(picks: Picks) => {
            setOpen(false);
            setOutcome(
              `Finished with ${readingCheckScore(check, picks)} of ${check.length} right. The route shows the celebration next.`
            );
          }}
        />
      )}
    </div>
  );
}
