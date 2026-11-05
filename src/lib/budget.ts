import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_MS = 60_000;
let cached: { total: number; at: number } | null = null;

/**
 * This month's AI spend, summed in the database, or null when it could not
 * be read.
 *
 * Arthur's ruling of 2026-11-05 on Checkpoint A, item 7: "budget check
 * totals spend in the database and fails closed". It used to read every
 * ai_calls row and add them up here, which undercounts once a month has
 * more rows than one response returns, and it read an error as zero spend.
 * `ai_spend_since` (migration 0026) returns the sum. A failed read is null
 * and is not cached, so the next check tries again.
 *
 * Cached per instance for 60 seconds, which is "checked within the last 60
 * seconds" per the brief; it does not need cross-instance consistency.
 */
export async function getMonthlySpend(): Promise<number | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.total;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  try {
    const { data, error } = await createAdminClient().rpc("ai_spend_since", {
      since: startOfMonth.toISOString(),
    });
    const total = Number(data);
    if (error || data === null || data === undefined || !Number.isFinite(total)) {
      console.error("[budget] monthly spend could not be read:", error?.message ?? `got ${String(data)}`);
      return null;
    }
    cached = { total, at: Date.now() };
    return total;
  } catch (err) {
    console.error("[budget] monthly spend could not be read:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Whether judging should stop for the month. Fails closed both ways: an
 * unset ceiling blocks judging rather than allowing unlimited spend, and
 * so does a spend that could not be read. AI_MONTHLY_BUDGET_USD=50 is the
 * current value; see docs/decisions.md for the math behind that number.
 */
export async function isBudgetExceeded(): Promise<boolean> {
  const ceiling = Number(process.env.AI_MONTHLY_BUDGET_USD ?? "0");
  if (!(ceiling > 0)) return true;
  const spent = await getMonthlySpend();
  if (spent === null) return true;
  return spent >= ceiling;
}

/** Tests only: forget the cached total. */
export function resetBudgetCacheForTests(): void {
  cached = null;
}
