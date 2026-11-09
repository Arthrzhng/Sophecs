import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetState } from "@/lib/budget";
import { authorForSeq, MAX_SEQ } from "@/lib/counterpart";
import { screenAndLog, SCREEN_DAILY_CAP, type ScreenCallResult } from "@/lib/screen";

/**
 * Re-screens arena replies left `pending`, and delivers the ones that pass.
 *
 * Arthur's ruling of 2026-11-05 on Checkpoint B, (d) 4: "a small scheduled
 * re-screening job for pending replies, inside the monthly budget". A
 * reply is saved as `pending` before it is screened, and stays pending when
 * screening is paused, over budget, over the author's daily cap or fails
 * (src/app/api/counterpart/turn/route.ts). Its author is told it "will be
 * delivered once it has been checked", and until this job nothing checked
 * it again. /api/cron/rescreen runs this once a day (vercel.json).
 *
 * Under the same rules as the route, so nothing here is more permissive:
 * - nothing runs while KILL_SWITCH_SCREEN is on, or KILL_SWITCH_JUDGE
 *   (Arthur, 2026-11-09, item 23: "one switch stops all AI"), or while the month's
 *   budget is spent or cannot be read (budgetState fails closed; it is
 *   checked again before each call, though it caches for a minute);
 * - an author over SCREEN_DAILY_CAP screen calls in the last 24 hours, or
 *   whose count cannot be read, waits for the next run;
 * - a reply is delivered only if the screen returns `ok`; anything else
 *   holds it, as the route does. A failed call leaves it pending;
 * - only a reply the route could have delivered is screened. The read
 *   takes replies in an open exchange, not a sample account's (the sample
 *   engine writes its turns already screened, and its rows are its own),
 *   by an author who still has an account, to a counterpart who still has
 *   one; a reply that is not its exchange's latest, or whose author's turn
 *   it is not by sequence and by next_turn, is then skipped. However
 *   long ago the exchange's last delivered reply was: a pending reply
 *   holds the lapse clock until it is screened (Arthur, 2026-11-07, Gate 4
 *   item 12; exchangeLapsed in src/lib/counterpart.ts);
 * - every write is conditional on what was read: the reply only while
 *   still pending, the hand-over only while the exchange is still open and
 *   waiting on that author. If the hand-over does not take, the reply goes
 *   back to pending, so it is never visible in an exchange that has not
 *   moved on.
 *
 * At most RESCREEN_BATCH screen calls a run, oldest first, each reply at
 * least RESCREEN_MIN_AGE_MS old so a submission still being screened by
 * the route is never screened twice, and none started once
 * RESCREEN_TIME_BUDGET_MS has passed, well inside the route's 60 seconds.
 * One screen call is about $0.0006 (src/lib/screen.ts), so a run costs at
 * most about a cent.
 *
 * COST: model=claude-haiku-4-5 (src/lib/screen.ts) | trigger=daily cron | est_usd_per_call=0.0006 | at most RESCREEN_BATCH calls a run | budget=AI_MONTHLY_BUDGET_USD, checked before each call | kill_switch=KILL_SWITCH_SCREEN, and KILL_SWITCH_JUDGE, which stops all AI | logged_to=ai_calls kind=screen
 */

export const RESCREEN_BATCH = 20;
export const RESCREEN_MIN_AGE_MS = 10 * 60 * 1000;
export const RESCREEN_TIME_BUDGET_MS = 40 * 1000;
/**
 * Each screen call's own limit, with no retries, so a call started just
 * inside RESCREEN_TIME_BUDGET_MS still ends inside the route's 60 seconds
 * and is logged; one cut off by the platform would be billed and unlogged.
 */
export const RESCREEN_CALL_TIMEOUT_MS = 15 * 1000;
/** How many candidate replies one run reads, of which at most RESCREEN_BATCH are screened. */
export const RESCREEN_READ_LIMIT = 100;

export interface RescreenDeps {
  screen: (params: { quotedClaim: string; body: string; userId: string }) => Promise<ScreenCallResult>;
  budget: () => Promise<"ok" | "over" | "unread">;
  killed: () => boolean;
  now: () => Date;
  /** Milliseconds, for the time budget. */
  clock: () => number;
}

const DEFAULT_DEPS: RescreenDeps = {
  screen: (params) => screenAndLog(params, { timeout: RESCREEN_CALL_TIMEOUT_MS, maxRetries: 0 }),
  budget: budgetState,
  // The judge's switch is read as the judge route reads it, with no
  // allowlist: the job screens for no one in particular.
  killed: () => process.env.KILL_SWITCH_SCREEN === "true" || process.env.KILL_SWITCH_JUDGE === "true",
  now: () => new Date(),
  clock: () => Date.now(),
};

export interface RescreenReport {
  /** Why the run did nothing at all, when it did nothing. */
  stoppedBy: "kill_switch" | "budget" | null;
  /** Pending replies read this run that the route could have delivered. */
  read: number;
  delivered: number;
  held: number;
  /** Left pending for the next run: the author's cap, a failed call, or the budget, batch or time ran out. */
  waiting: number;
  /** Left as they are: not the author's turn after all, or decided since they were read. */
  stranded: number;
  /** Screened ok, but the exchange would not take the hand-over; the reply went back to pending. */
  failed: number;
  /**
   * As `failed`, but the reply could not be put back either: it is visible
   * in an exchange still waiting on its author. Needs a hand to fix.
   */
  stuck: number;
}

type Candidate = {
  id: string;
  author_id: string;
  seq: number;
  quoted_claim: string;
  body: string;
  exchanges: { id: string; user_a: string | null; user_b: string | null; next_turn: string | null };
};

export async function rescreenPending(
  admin: SupabaseClient,
  deps: Partial<RescreenDeps> = {}
): Promise<RescreenReport> {
  const d = { ...DEFAULT_DEPS, ...deps };
  const started = d.clock();
  const report: RescreenReport = { stoppedBy: null, read: 0, delivered: 0, held: 0, waiting: 0, stranded: 0, failed: 0, stuck: 0 };

  if (d.killed()) return { ...report, stoppedBy: "kill_switch" };
  if ((await d.budget()) !== "ok") return { ...report, stoppedBy: "budget" };

  const now = d.now();
  // Filtered in the query, so replies that can never be delivered (a
  // closed, lapsed or sample exchange, a deleted author, a counterpart who
  // has since left) are never read and can never fill a run ahead of ones
  // that can. No filter on the exchange's last_turn_at: a reply that can be
  // delivered holds the lapse clock (src/lib/counterpart.ts,
  // exchangeLapsed).
  const { data, error } = await admin
    .from("turns")
    .select("id, author_id, seq, quoted_claim, body, exchanges!inner(id, user_a, user_b, next_turn)")
    .eq("screen_result", "pending")
    .not("author_id", "is", null)
    .lt("created_at", new Date(now.getTime() - RESCREEN_MIN_AGE_MS).toISOString())
    .eq("exchanges.status", "open")
    .eq("exchanges.is_sample", false)
    .not("exchanges.user_a", "is", null)
    .not("exchanges.user_b", "is", null)
    .order("created_at", { ascending: true })
    .limit(RESCREEN_READ_LIMIT);
  if (error) throw new Error(`pending replies could not be read: ${error.message}`);
  const rows = (data ?? []) as unknown as Candidate[];
  report.read = rows.length;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let calls = 0;
  for (let i = 0; i < rows.length; i++) {
    const turn = rows[i];
    const exchange = turn.exchanges;
    const turnOf = exchange.user_a && exchange.user_b ? authorForSeq(turn.seq, exchange.user_a, exchange.user_b) : null;
    if (!turn.author_id || turnOf !== turn.author_id || exchange.next_turn !== turn.author_id) {
      report.stranded++;
      continue;
    }

    if (calls >= RESCREEN_BATCH || d.clock() - started > RESCREEN_TIME_BUDGET_MS || (await d.budget()) !== "ok") {
      report.waiting += rows.length - i;
      break;
    }
    const { count, error: capError } = await admin
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", turn.author_id)
      .eq("kind", "screen")
      .gte("created_at", since);
    if (capError || (count ?? 0) >= SCREEN_DAILY_CAP) {
      report.waiting++;
      continue;
    }

    let screen: ScreenCallResult;
    calls++;
    try {
      screen = await d.screen({ quotedClaim: turn.quoted_claim, body: turn.body, userId: turn.author_id });
    } catch {
      report.waiting++;
      continue;
    }

    if (screen.result !== "ok") {
      const { data: heldRows } = await admin
        .from("turns")
        .update({ screen_result: "flagged", screen_reason: `${screen.result}: ${screen.reason}` })
        .eq("id", turn.id)
        .eq("screen_result", "pending")
        .select("id");
      if (heldRows?.length) report.held++;
      else report.stranded++;
      continue;
    }

    const { data: okRows } = await admin
      .from("turns")
      .update({ screen_result: "ok" })
      .eq("id", turn.id)
      .eq("screen_result", "pending")
      .select("id");
    if (!okRows?.length) {
      report.stranded++;
      continue;
    }
    // As the route delivers a reply (src/app/api/counterpart/turn/route.ts),
    // and only while the exchange is as it was read.
    const complete = turn.seq === MAX_SEQ;
    const { data: moved, error: moveError } = await admin
      .from("exchanges")
      .update({
        next_turn: complete ? null : exchange.user_a === turn.author_id ? exchange.user_b : exchange.user_a,
        last_turn_at: now.toISOString(),
        ...(complete ? { status: "complete" } : {}),
      })
      .eq("id", exchange.id)
      .eq("status", "open")
      .eq("next_turn", turn.author_id)
      .select("id");
    if (moveError || !moved?.length) {
      const { data: back, error: backError } = await admin
        .from("turns")
        .update({ screen_result: "pending" })
        .eq("id", turn.id)
        .eq("screen_result", "ok")
        .select("id");
      if (backError || !back?.length) report.stuck++;
      else report.failed++;
      continue;
    }
    report.delivered++;
  }
  return report;
}
