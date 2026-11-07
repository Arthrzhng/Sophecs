import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExchangeRow } from "@/components/me/OpenExchanges";
import { exchangeLapsed, latestReplyPending, type LapseExchange, type LapseTurn } from "@/lib/counterpart";
import type { SchoolId } from "@/lib/types";

// Where the lapse rule (src/lib/counterpart.ts, exchangeLapsed) meets the
// database: /me's list of open exchanges, and the exchange page's close on
// view. Kept here, apart from the pages, so both are tested as they run
// (tests/gate4-content-rulings.test.tsx).

export interface OpenExchangeRow extends LapseExchange {
  id: string;
  topic_slug: string;
  school_a: SchoolId;
  school_b: SchoolId;
}

export interface TurnState extends LapseTurn {
  exchange_id: string;
}

/**
 * The turns of the reader's open exchanges, for /me: who wrote each, its
 * place and how it was screened, no text. None to read, none read. Null if
 * the read failed, which is not the same as no turns: a pending reply may
 * be holding an exchange open.
 */
export async function readExchangeTurns(admin: SupabaseClient, exchangeIds: readonly string[]): Promise<TurnState[] | null> {
  if (exchangeIds.length === 0) return [];
  const { data, error } = await admin.from("turns").select("exchange_id, seq, author_id, screen_result").in("exchange_id", [...exchangeIds]);
  if (error) return null;
  return (data as TurnState[] | null) ?? [];
}

/**
 * /me's open exchanges: lapsed ones left out (closing them is the exchange
 * page's job, on view), each saying whether the reader's own latest reply
 * is waiting to be screened, which /me shows as "Waiting to be checked"
 * (Arthur, 2026-11-07, Gate 4 item 12). The turns may come in any order.
 * Turns null means they could not be read: then no exchange is left out,
 * as the exchange page closes nothing on a read that failed, and none
 * says a reply is waiting.
 */
export function meExchangeRows(
  exchanges: readonly OpenExchangeRow[],
  turns: readonly TurnState[] | null,
  userId: string,
  titleOf: (slug: string) => string,
  now: Date = new Date()
): ExchangeRow[] {
  const bySeq = [...(turns ?? [])].sort((a, b) => a.seq - b.seq);
  const turnsOf = (id: string) => bySeq.filter((t) => t.exchange_id === id);
  return exchanges
    .filter((row) => turns === null || !exchangeLapsed(row, turnsOf(row.id), now))
    .map((row) => ({
      id: row.id,
      topicTitle: titleOf(row.topic_slug),
      theirSchool: row.user_a === userId ? row.school_b : row.school_a,
      myTurn: row.next_turn === userId,
      myReplyPending: turns !== null && latestReplyPending(turnsOf(row.id), userId),
    }));
}

/** The exchange row's fields the lapse rule reads, as the page has them. */
export function exchangeForLapse(row: Record<string, unknown>): LapseExchange & { id: string; status: string } {
  return {
    id: row.id as string,
    status: row.status as string,
    user_a: (row.user_a as string | null) ?? null,
    user_b: (row.user_b as string | null) ?? null,
    next_turn: (row.next_turn as string | null) ?? null,
    last_turn_at: row.last_turn_at as string,
  };
}

/**
 * The exchange page's close on view. Closes an open exchange that has
 * lapsed, only while it is still open and waiting on whoever it was
 * waiting on when read: a delivery moves `next_turn`, so one the daily job
 * has just made is not closed under it. Returns the status to show: if the
 * close did not take, the exchange's status as it now stands (only the
 * status is read again). `turns` null means they could not be read, and
 * nothing is closed on a read that failed.
 */
export async function closeIfLapsed(
  admin: SupabaseClient,
  exchange: LapseExchange & { id: string; status: string },
  turns: readonly LapseTurn[] | null,
  now: Date = new Date()
): Promise<string> {
  if (turns === null || exchange.status !== "open" || !exchangeLapsed(exchange, turns, now)) return exchange.status;
  const close = admin.from("exchanges").update({ status: "lapsed", next_turn: null }).eq("id", exchange.id).eq("status", "open");
  const { data: closed } = await (exchange.next_turn ? close.eq("next_turn", exchange.next_turn) : close.is("next_turn", null)).select("id");
  if (closed?.length) return "lapsed";
  const { data: now_ } = await admin.from("exchanges").select("status").eq("id", exchange.id).maybeSingle();
  return (now_?.status as string | undefined) ?? exchange.status;
}
