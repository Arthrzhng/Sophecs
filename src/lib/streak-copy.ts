/**
 * The one place the streak is explained in words.
 *
 * Extracted from StreakBlock rather than copied into the Today sidebar:
 * docs/daily-path-copy.md §5 gives the same three lines the profile already
 * used, and two copies of a rule this specific is exactly how the two drift
 * when the rule changes. The rule itself lives in streak.ts and is not
 * touched here.
 */
export function streakLine(streak: number): string {
  if (streak === 0) {
    return "Days in a row with a judged argument scoring 40 or more. Nothing happens when it breaks.";
  }
  const word = streak === 1 ? "Day" : "Days";
  return `${word} in a row with a judged argument scoring 40 or more. Resets at midnight UTC.`;
}

/**
 * What the streak card says while judging is paused.
 *
 * A streak day needs a judged argument, so with judging off nobody can hold
 * one and every reader would otherwise see a bare zero with no explanation
 * for why it never moves. The number is hidden in this state.
 */
export const STREAK_PAUSED_LINE =
  "Streaks start when judging opens. A day counts when you have an argument judged 40 or more.";
