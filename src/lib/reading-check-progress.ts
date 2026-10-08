import { READING_CHECK_LENGTH } from "./lesson-chunks";

/**
 * Where a reader's reading-check picks live.
 *
 * Browser storage, not the server, per docs/daily-path-copy.md §2: the score
 * gates nothing, so a row per answer would be a migration and a write path
 * for something only ever read back to draw one tile. The cost, recorded
 * there too, is that step 2 does not follow a reader across devices.
 *
 * Keyed by user as well as topic for the same reason the argument drafts are:
 * two people on one browser must not see each other's answers.
 */
export function checkKey(userId: string, topicSlug: string): string {
  return `check:${userId}:${topicSlug}`;
}

export type Picks = (number | undefined)[];

/**
 * Picks for one topic, or an empty list.
 *
 * Every read is guarded: storage throws rather than returning null in a
 * private window with site data blocked, and a reader who has answered
 * nothing and a reader whose storage is unavailable should both simply see
 * the check, not an error.
 */
export function loadPicks(userId: string, topicSlug: string): Picks {
  try {
    const raw = localStorage.getItem(checkKey(userId, topicSlug));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything that is not a plain option index is treated as unanswered,
    // which is also what a hand-edited or stale value degrades to.
    return parsed
      .slice(0, READING_CHECK_LENGTH)
      .map((v) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined));
  } catch {
    return [];
  }
}

export function savePicks(userId: string, topicSlug: string, picks: Picks): void {
  try {
    localStorage.setItem(checkKey(userId, topicSlug), JSON.stringify(picks));
  } catch {
    // Storage unavailable. The check still works for this sitting; it just
    // will not be remembered, which is better than failing the step.
  }
}

/** True once every question has a pick. Drives path node 2. */
export function isCheckComplete(picks: Picks): boolean {
  return (
    picks.length >= READING_CHECK_LENGTH &&
    picks.slice(0, READING_CHECK_LENGTH).every((p) => p !== undefined)
  );
}
