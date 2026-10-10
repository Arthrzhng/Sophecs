"use client";

import { useEffect, useRef } from "react";
import { Celebration } from "@/components/daily-path/Celebration";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { StatTile } from "@/components/daily-path/StatTile";
import { READING_CHECK_LENGTH } from "@/lib/lesson-chunks";
import type { SchoolId } from "@/lib/types";

// Headings by score, from docs/daily-path-copy.md §2. Indexed by score, so
// 0 right reads "Worth another read." and 2 right reads "Both right."
const HEADINGS = ["Worth another read.", "One of two.", "Both right."];

/**
 * What the reader sees after the second question.
 *
 * Deliberately without a streak tile or a flame: a streak day is a judged
 * argument scoring 40 or more, and reading does not extend one. Showing a
 * flame here would promise something the rules do not give.
 */
export function ReadingCheckDone({
  score,
  notesWritten,
  school,
  onArgue,
  onReadAgain,
}: {
  score: number;
  notesWritten: number;
  school: SchoolId;
  onArgue: () => void;
  onReadAgain: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  // The check was a modal dialog, and closing it leaves focus on the
  // document body. Taking it here means a keyboard or screen-reader user
  // arrives at the score rather than at the top of the page, and hears it:
  // a focused container is read out, which is the whole of this screen.
  useEffect(() => {
    root.current?.focus();
  }, []);

  return (
    <div ref={root} tabIndex={-1} className="outline-none">
      <Celebration
        heading={HEADINGS[score] ?? HEADINGS[0]}
        tiles={
          <>
            <StatTile label="Reading check" value={`${score}/${READING_CHECK_LENGTH}`} />
            <StatTile
              label="Notes written"
              value={`${notesWritten}/${READING_CHECK_LENGTH}`}
            />
          </>
        }
        note="Your notes will be waiting above the editor."
        action={
          <ChunkyButton school={school} onClick={onArgue}>
            Argue the motion
          </ChunkyButton>
        }
        secondary={
          score < READING_CHECK_LENGTH ? (
            <button
              type="button"
              onClick={onReadAgain}
              className="min-h-11 text-sm text-ink-mid underline underline-offset-4 hover:text-ink"
            >
              Read the passage again
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
