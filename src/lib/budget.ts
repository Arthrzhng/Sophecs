import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_MS = 60_000;
let cached: { total: number; at: number } | null = null;

// Best-effort per-instance cache — good enough for "checked within the last
// 60 seconds" per the brief; doesn't need cross-instance consistency.
export async function getMonthlySpend(): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.total;

  const admin = createAdminClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from("ai_calls")
    .select("cost_usd")
    .gte("created_at", startOfMonth.toISOString());

  const total = error ? 0 : (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0);
  cached = { total, at: Date.now() };
  return total;
}

// Fails closed: an unset ceiling blocks judging rather than allowing
// unlimited spend. AI_MONTHLY_BUDGET_USD=50 is the current value — see
// docs/decisions.md for the math behind that number.
export async function isBudgetExceeded(): Promise<boolean> {
  const ceiling = Number(process.env.AI_MONTHLY_BUDGET_USD ?? "0");
  if (ceiling <= 0) return true;
  const spent = await getMonthlySpend();
  return spent >= ceiling;
}
