/**
 * Which wording a debate is about.
 *
 * Every surface that shows or judges a particular debate reads the motion
 * stored with that debate, not the motion as it reads now. The two differ
 * whenever a motion has been reworded since, and `docs/decisions.md`
 * records what that cost: rewording a motion rewrote what every past
 * verdict page said the argument was arguing, and an argument submitted
 * before a reword and judged after it would have been scored against a
 * motion its author never read.
 *
 * `debates.motion_text` is filled at submission from 2D onward. A row
 * written before the column existed has null, and null is the only case
 * that falls back to the live motion, because for those rows there is
 * nothing else to show. An empty string is not a fallback: nothing writes
 * one, and treating it as missing would hide the bug that did.
 */
export function motionForDebate(
  storedMotionText: string | null | undefined,
  liveMotion: string
): string {
  return storedMotionText ?? liveMotion;
}

/**
 * The motion as it appears in share copy, shortened.
 *
 * Pulled out of the verdict page so that "a reword does not change the
 * share text of an existing verdict" is a property a test can check,
 * rather than a line of JSX nobody can reach.
 */
export const SHARE_MOTION_MAX = 60;

export function shortMotionForShare(motion: string): string {
  return motion.length > SHARE_MOTION_MAX
    ? `${motion.slice(0, SHARE_MOTION_MAX - 3)}...`
    : motion;
}
