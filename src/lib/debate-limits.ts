// Shared between the client editor (UI feedback) and /api/judge (the real
// enforcement) so the two numbers can't drift apart.
export const MIN_ARGUMENT_WORDS = 80;
export const MAX_ARGUMENT_WORDS = 400;
export const WORD_COUNT_WARNING_AT = 380;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Days a judged original locks its motion for.
 *
 * /api/judge holds the authoritative copy and enforces it; this one exists
 * so the arena list can say a motion is locked before the reader writes
 * four hundred words and is turned away at submission. The two are a
 * deliberate duplicate rather than one import, because the judge route is
 * frozen for the presentation rebuild and moving a constant out of it would
 * be a change to it. Fold them together when that freeze lifts.
 */
export const TOPIC_LOCK_DAYS = 7;
