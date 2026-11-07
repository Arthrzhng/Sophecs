// Pure — no `server-only`, no database, so the quote and turn rules are
// unit-testable and the composer can apply the same limits client-side that
// the route enforces server-side.

export const MIN_QUOTE_CHARS = 10;
export const MAX_QUOTE_CHARS = 300;
export const MIN_TURN_CHARS = 150;
export const MAX_TURN_CHARS = 1200;
export const MAX_SEQ = 4;
export const LAPSE_DAYS = 14;

// What a reply's author is told while it waits to be screened: on the
// composer straight after sending, and on the exchange page afterwards.
// The second sentence is true because of the daily job in
// src/lib/rescreen.ts (Arthur's ruling of 2026-11-05, (e) 8: "keep the
// copy accurate").
export const REPLY_SAVED_COPY =
  "Your reply is saved and will be delivered once it has been checked. A check that could not run is tried again once a day.";

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

/**
 * Whether the reader's own latest reply is saved and not yet screened. Then
 * the turn is still theirs, and the route would refuse a further reply
 * until this one is decided. Only the latest reply counts: an older
 * pending reply of theirs that the exchange has moved past must not lock
 * them out. `turns` in sequence order.
 */
export function latestReplyPending(
  turns: readonly { author_id: string | null; screen_result: string }[],
  userId: string
): boolean {
  const last = turns[turns.length - 1];
  return Boolean(last && last.author_id === userId && last.screen_result === "pending");
}

export function isLapsed(lastTurnAt: string | Date, now: Date = new Date()): boolean {
  const last = typeof lastTurnAt === "string" ? new Date(lastTurnAt) : lastTurnAt;
  return now.getTime() - last.getTime() > LAPSE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Whether an open exchange has lapsed: LAPSE_DAYS since its last delivered
 * reply, except that a reply saved and not yet screened holds the clock
 * until it is screened (Arthur, 2026-11-07, Gate 4 item 12). The daily job
 * in src/lib/rescreen.ts may still deliver it, which restarts the clock as
 * any delivery does; held instead, it leaves the clock running from the
 * last delivered reply, as a reply held when it is sent does.
 *
 * Only a reply the job could deliver holds it: the latest, by an author
 * who still has an account and whose turn it is (`nextTurn`). `turns` in
 * sequence order.
 */
export function exchangeLapsed(
  lastTurnAt: string | Date,
  turns: readonly { author_id: string | null; screen_result: string }[],
  nextTurn: string | null,
  now: Date = new Date()
): boolean {
  const last = turns[turns.length - 1];
  if (last && last.screen_result === "pending" && last.author_id !== null && last.author_id === nextTurn) return false;
  return isLapsed(lastTurnAt, now);
}

// What a turn must quote: the counterpart's original argument for the first
// exchange of replies, and their previous turn once the exchange is under
// way. Turn 1 and 2 answer arguments; 3 and 4 answer replies.
export function quoteSourceForSeq(seq: number): "argument" | "previous_turn" {
  return seq <= 2 ? "argument" : "previous_turn";
}
