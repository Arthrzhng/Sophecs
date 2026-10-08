// The six steps and their captions, verbatim from docs/daily-path-copy.md §3.
export const TODAY_STEPS = [
  { title: "Read the case", caption: "The passage, and two notes in your own words" },
  { title: "Check your reading", caption: "Two questions on what you just read" },
  { title: "Argue the motion", caption: "Argue from your school. A judge scores it." },
  { title: "Face an objection", caption: "The judge names the objection you left standing" },
  { title: "Revise once", caption: "Answer it. One revision, no effect on your rating." },
  { title: "Case closed", caption: "Your before and after, side by side" },
] as const;

// From mockup 00. The column snakes; PathNode scales these down on a phone.
export const TODAY_SHIFTS = [0, -70, -40, 50, 80, 20] as const;

// Steps 3 to 6 need a verdict, so they are the ones the kill switch holds
// shut. 0-based, so index 2 is step 3.
export const FIRST_JUDGED_STEP = 2;

export type StepState = "done" | "current" | "locked";
export type StepLockReason = "order" | "judging";

export interface StepStatus {
  state: StepState;
  lockReason: StepLockReason;
}

/**
 * What each of the six nodes shows.
 *
 * Pure, and tested, because it is the piece most easily got wrong and the
 * hardest to click through: reaching steps 3 to 6 at all needs a judged
 * argument, which needs judging to be on.
 *
 * Order of the checks matters. `done` wins over every lock, so a step
 * finished while the reader was allowlisted stays finished if the switch is
 * later flipped back on. After that, judging locks beat order locks,
 * because "waiting for judging" is the more useful thing to be told.
 */
export function todayPathStates(done: boolean[], paused: boolean): StepStatus[] {
  const firstOpen = done.findIndex((d) => !d);
  return done.map((isDone, i) => {
    if (isDone) return { state: "done", lockReason: "order" };
    if (paused && i >= FIRST_JUDGED_STEP) return { state: "locked", lockReason: "judging" };
    if (firstOpen !== -1 && i > firstOpen) return { state: "locked", lockReason: "order" };
    return { state: "current", lockReason: "order" };
  });
}

/**
 * The six done-flags, from the server's case state and the browser's check.
 *
 * Nodes 3 and 4 complete together, and so do 5 and 6: one judged argument
 * produces both the verdict and the objection, and one judged revision both
 * answers it and closes the case.
 */
export function todayDoneFlags(
  progress: { read: boolean; argued: boolean; answered: boolean; closed: boolean },
  checked: boolean
): boolean[] {
  return [
    progress.read,
    checked,
    progress.argued,
    progress.argued,
    progress.answered,
    progress.closed,
  ];
}

/** True when there is a step the reader can actually act on right now. */
export function hasActionableStep(states: StepStatus[]): boolean {
  return states.some((s) => s.state === "current");
}
