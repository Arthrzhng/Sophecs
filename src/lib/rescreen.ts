import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetState } from "@/lib/budget";
import { MAX_SEQ } from "@/lib/counterpart";
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
 * - nothing runs while KILL_SWITCH_SCREEN is on, or while the month's
 *   budget is spent or cannot be read (budgetState fails closed);
 * - an author over SCREEN_DAILY_CAP screen calls in the last 24 hours
 *   waits for the next run;
 * - a reply is delivered only if the screen returns `ok`; anything else
 *   holds it, as the route does. A failed call leaves it pending;
 * - it is delivered only into an exchange that is still open and still
 *   waiting on its author, and only if it is still pending when written,
 *   so a run never overwrites a decision made since it read the row;
 * - a sample account's exchange is never touched: no screen call and no
 *   write. The sample engine writes its turns already screened, and its
 *   rows are its own to keep (docs/sample-activity.md).
 *
 * At most RESCREEN_BATCH replies a run, oldest first, each at least
 * RESCREEN_MIN_AGE_MS old so a submission still being screened by the
 * route is never screened twice. One screen call is about $0.0006
 * (src/lib/screen.ts), so a run costs at most about a cent.
 *
 * COST: model=claude-haiku-4-5 (src/lib/screen.ts) | trigger=daily cron | est_usd_per_call=0.0006 | at most RESCREEN_BATCH calls a run | budget=AI_MONTHLY_BUDGET_USD, checked before each call | kill_switch=KILL_SWITCH_SCREEN | logged_to=ai_calls kind=screen
 */

export const RESCREEN_BATCH = 20;
export const RESCREEN_MIN_AGE_MS = 10 * 60 * 1000;

export interface RescreenDeps {
  screen: (params: { quotedClaim: string; body: string; userId: string }) => Promise<ScreenCallResult>;
  budget: () => Promise<"ok" | "over" | "unread">;
  killed: () => boolean;
  now: () => Date;
}

const DEFAULT_DEPS: RescreenDeps = {
  screen: screenAndLog,
  budget: budgetState,
  killed: () => process.env.KILL_SWITCH_SCREEN === "true",
  now: () => new Date(),
};

export interface RescreenReport {
  /** Why the run did nothing at all, when it did nothing. */
  stoppedBy: "kill_switch" | "budget" | null;
  /** Pending replies read this run. */
  read: number;
  delivered: number;
  held: number;
  /** Left pending for the next run: over the author's cap, a failed call, or the budget ran out mid-run. */
  waiting: number;
  /** Left pending for good: the exchange is closed or no longer waiting on this author. */
  stranded: number;
  /** In a sample account's exchange, so left exactly as it is. */
  sample: number;
}

export async function rescreenPending(
  admin: SupabaseClient,
  deps: Partial<RescreenDeps> = {}
): Promise<RescreenReport> {
  const d = { ...DEFAULT_DEPS, ...deps };
  const report: RescreenReport = { stoppedBy: null, read: 0, delivered: 0, held: 0, waiting: 0, stranded: 0, sample: 0 };

  if (d.killed()) return { ...report, stoppedBy: "kill_switch" };
  if ((await d.budget()) !== "ok") return { ...report, stoppedBy: "budget" };

  const now = d.now();
  const { data: pending, error } = await admin
    .from("turns")
    .select("id, exchange_id, author_id, seq, quoted_claim, body")
    .eq("screen_result", "pending")
    .lt("created_at", new Date(now.getTime() - RESCREEN_MIN_AGE_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(RESCREEN_BATCH);
  if (error) throw new Error(`pending replies could not be read: ${error.message}`);
  report.read = pending?.length ?? 0;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const rows = pending ?? [];
  for (let i = 0; i < rows.length; i++) {
    const turn = rows[i];
    const { data: exchange } = await admin
      .from("exchanges")
      .select("id, user_a, user_b, status, next_turn, is_sample")
      .eq("id", turn.exchange_id)
      .maybeSingle();
    if (exchange?.is_sample) {
      report.sample++;
      continue;
    }
    if (!exchange || exchange.status !== "open" || exchange.next_turn !== turn.author_id) {
      report.stranded++;
      continue;
    }

    // Checked before every call, not once: a run can spend the month's
    // last cents (the total is cached for a minute, src/lib/budget.ts).
    if ((await d.budget()) !== "ok") {
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
    // As the route delivers a reply (src/app/api/counterpart/turn/route.ts).
    const complete = turn.seq === MAX_SEQ;
    await admin
      .from("exchanges")
      .update({
        next_turn: complete ? null : exchange.user_a === turn.author_id ? exchange.user_b : exchange.user_a,
        last_turn_at: now.toISOString(),
        ...(complete ? { status: "complete" } : {}),
      })
      .eq("id", exchange.id);
    report.delivered++;
  }
  return report;
}
