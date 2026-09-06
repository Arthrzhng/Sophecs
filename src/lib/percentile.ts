import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { value: number; at: number }>();

// Wraps the elo_percentile() db function (see supabase/migrations/0006) with
// a 5-minute per-user cache, per the brief. Best-effort/per-instance, same
// pattern as lib/budget.ts's monthly-spend cache.
export async function getEloPercentile(userId: string, elo: number): Promise<number> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("elo_percentile", { user_elo: elo });
  const value = error || data == null ? 0 : Number(data);
  cache.set(userId, { value, at: Date.now() });
  return value;
}
