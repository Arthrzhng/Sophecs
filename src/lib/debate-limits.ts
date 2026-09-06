// Shared between the client editor (UI feedback) and /api/judge (the real
// enforcement) so the two numbers can't drift apart.
export const MIN_ARGUMENT_WORDS = 80;
export const MAX_ARGUMENT_WORDS = 400;
export const WORD_COUNT_WARNING_AT = 380;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
