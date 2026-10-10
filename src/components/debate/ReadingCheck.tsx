"use client";

import { useEffect, useRef, useState } from "react";
import { revealMark } from "./LessonOverlay";
import { ReadingCheckStep } from "./ReadingCheckStep";
import type { ReadingCheckQuestion } from "@/lib/lesson-chunks";
import {
  isCheckComplete,
  loadPicks,
  savePicks,
  type Picks,
} from "@/lib/reading-check-progress";
import type { SchoolId } from "@/lib/types";

/**
 * The graded check that follows the passage and the two typed notes.
 *
 * It gates nothing: a reader who gets both wrong goes on to argue exactly as
 * one who got both right does. What it produces is the score on the
 * celebration and the completion of path step 2.
 *
 * A modal <dialog> rather than a section of the page, because the check is
 * the one screen in the product that wants the reader's whole attention:
 * the overlay covers the site header, and the browser's own top layer gives
 * the focus trap, the Escape handler and the inert background that a
 * hand-rolled version of this would get wrong. No new dependency, and the
 * same element the confirmation dialogs already use.
 *
 * Picks are kept in browser storage rather than on the server
 * (docs/daily-path-copy.md §2), so coming back to a finished check shows the
 * score rather than asking the questions again. Leaving part-way through
 * stores nothing: an abandoned check is not a half-finished one.
 */
export function ReadingCheck({
  check,
  topicSlug,
  userId,
  school,
  onLeave,
  onDone,
}: {
  check: ReadingCheckQuestion[];
  topicSlug: string;
  userId: string;
  school: SchoolId;
  /** The X and Escape. Leaves the check without recording anything. */
  onLeave: () => void;
  /** Called with the final picks once the last question is acknowledged. */
  onDone: (picks: Picks) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [picks, setPicks] = useState<Picks>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  // Focus is moved by query from the dialog rather than through refs handed
  // down into the step, which stays presentational so the styleguide can
  // render four of them at once. Both targets are unique inside the dialog:
  // one h1, and one role="status", which is the feedback bar.
  function focusIn(selector: string) {
    dialog.current?.querySelector<HTMLElement>(selector)?.focus();
  }

  // Restore on mount only. Reading storage during render would differ
  // between the server pass and the first client pass and break hydration.
  useEffect(() => {
    setPicks(loadPicks(userId, topicSlug));
  }, [userId, topicSlug]);

  // Opened from an effect rather than rendered with the `open` attribute:
  // only showModal() puts the dialog in the top layer, and only the top
  // layer traps focus and makes the page behind it inert. An `open` dialog
  // is just a visible box that a Tab can still leave.
  //
  // Focus starts on the question rather than on the X, which is where the
  // dialog's own autofocus would otherwise land it: the first thing a
  // screen reader should hear is what is being asked, not the way out.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    focusIn("h1");
  }, []);

  // Escape reaches the dialog as `cancel`. Prevented and handled here so
  // that leaving by keyboard and leaving by the X do the same thing, rather
  // than the keyboard closing the dialog and stranding the route behind it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onLeave();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onLeave]);

  // The page behind a modal dialog is inert but still scrollable, so a
  // wheel over the overlay would move a page nobody can see and leave the
  // reader somewhere else when they come back.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  // Checking an answer unmounts the button that was just pressed, which
  // would drop focus onto the document body and send the next Tab back to
  // the X. The bar holds exactly one control and it is the only thing left
  // to do, so focus follows the answer down to it.
  useEffect(() => {
    if (!checked) return;
    // Scrolled before focus moves, because focusing a visible button
    // scrolls nothing and focusing a hidden one would fight this.
    revealMark(dialog.current);
    focusIn('[role="status"] button');
  }, [checked]);

  function onCheck() {
    if (picked === null) return;
    const next = [...picks];
    next[index] = picked;
    setPicks(next);
    // Only a finished check is written. Saving each answer as it was
    // checked meant a reader who left after the first question came back to
    // a check that remembered half an opinion of them, and docs §2 makes
    // the stored value the completion of step 2 — which one answer is not.
    if (isCheckComplete(next)) savePicks(userId, topicSlug, next);
    setChecked(true);
  }

  function advance() {
    if (index === check.length - 1) {
      onDone(picks);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setChecked(false);
    // Move focus to the new question rather than leaving it on a button
    // that has just been replaced, which would drop a keyboard user back
    // to the top of the dialog.
    requestAnimationFrame(() => focusIn("h1"));
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Check your reading"
      // The UA centres a dialog and caps it at a fraction of the viewport,
      // so every one of those defaults has to be undone for it to be the
      // screen rather than a box on it. The backdrop is paper too: at an
      // odd viewport height a dark seam under an opaque overlay is the only
      // thing it could ever show.
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-paper"
    >
      <ReadingCheckStep
        question={check[index]}
        index={index}
        total={check.length}
        picked={picked}
        checked={checked}
        school={school}
        onPick={setPicked}
        onCheck={onCheck}
        onAdvance={advance}
        onLeave={onLeave}
      />
    </dialog>
  );
}
