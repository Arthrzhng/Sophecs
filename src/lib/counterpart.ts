// Pure — no `server-only`, no database, so the quote and turn rules are
// unit-testable and the composer can apply the same limits client-side that
// the route enforces server-side.

export const MIN_QUOTE_CHARS = 10;
export const MAX_QUOTE_CHARS = 300;
export const MIN_TURN_CHARS = 150;
export const MAX_TURN_CHARS = 1200;
export const MAX_SEQ = 4;
export const LAPSE_DAYS = 14;

// Whitespace-insensitive substring test. A student selecting a sentence in
// the browser picks up whatever line breaks the paragraph happened to have,
// and a quote that is character-perfect apart from a newline is still the
// sentence they are answering.
export function normaliseForQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function quoteIsFromSource(quote: string, source: string): boolean {
  const q = normaliseForQuote(quote);
  if (q.length === 0) return false;
  return normaliseForQuote(source).includes(q);
}

export type QuoteProblem = "too_short" | "too_long" | "not_found";
export type BodyProblem = "too_short" | "too_long";

export function checkQuote(quote: string, source: string): QuoteProblem | null {
  const trimmed = quote.trim();
  if (trimmed.length < MIN_QUOTE_CHARS) return "too_short";
  if (trimmed.length > MAX_QUOTE_CHARS) return "too_long";
  if (!quoteIsFromSource(trimmed, source)) return "not_found";
  return null;
}

export function checkBody(body: string): BodyProblem | null {
  const trimmed = body.trim();
  if (trimmed.length < MIN_TURN_CHARS) return "too_short";
  if (trimmed.length > MAX_TURN_CHARS) return "too_long";
  return null;
}

// Turns 1 and 3 belong to A (the opener), 2 and 4 to B. `seq` is
// 1-indexed, so odd is A.
export function authorForSeq(seq: number, userA: string, userB: string): string {
  return seq % 2 === 1 ? userA : userB;
}

export function isLapsed(lastTurnAt: string | Date, now: Date = new Date()): boolean {
  const last = typeof lastTurnAt === "string" ? new Date(lastTurnAt) : lastTurnAt;
  return now.getTime() - last.getTime() > LAPSE_DAYS * 24 * 60 * 60 * 1000;
}

// What a turn must quote: the counterpart's original argument for the first
// exchange of replies, and their previous turn once the exchange is under
// way. Turn 1 and 2 answer arguments; 3 and 4 answer replies.
export function quoteSourceForSeq(seq: number): "argument" | "previous_turn" {
  return seq <= 2 ? "argument" : "previous_turn";
}
