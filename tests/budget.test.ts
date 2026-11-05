// The monthly budget (src/lib/budget.ts): totalled in the database by
// ai_spend_since (migration 0026), and closed when it cannot be read or no
// ceiling is set. Arthur's ruling of 2026-11-05 on Checkpoint A, item 7.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let reply: { data: unknown; error: { message: string } | null } | Error = { data: 0, error: null };
const calls: { fn: string; args: Record<string, unknown> }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (reply instanceof Error) throw reply;
      return reply;
    },
  }),
}));

const { getMonthlySpend, isBudgetExceeded, resetBudgetCacheForTests } = await import("../src/lib/budget");

beforeEach(() => {
  resetBudgetCacheForTests();
  calls.length = 0;
  reply = { data: 0, error: null };
  vi.stubEnv("AI_MONTHLY_BUDGET_USD", "50");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the monthly budget", () => {
  it("asks the database for the month's sum, from the first of the month", async () => {
    reply = { data: 12.34, error: null };
    expect(await getMonthlySpend()).toBe(12.34);
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("ai_spend_since");
    const since = new Date(String(calls[0].args.since));
    expect(since.getUTCDate()).toBe(1);
    expect(since.getUTCHours() + since.getUTCMinutes() + since.getUTCSeconds()).toBe(0);
  });

  it("reads a numeric that comes back as text", async () => {
    reply = { data: "49.99", error: null };
    expect(await isBudgetExceeded()).toBe(false);
  });

  it("stops at the ceiling", async () => {
    reply = { data: 50, error: null };
    expect(await isBudgetExceeded()).toBe(true);
  });

  it("fails closed on an error, a missing value or a throw, and does not cache it", async () => {
    for (const r of [
      { data: null, error: { message: "function ai_spend_since does not exist" } },
      { data: null, error: null },
      { data: "not a number", error: null },
      new Error("network"),
    ]) {
      resetBudgetCacheForTests();
      reply = r;
      expect(await getMonthlySpend()).toBeNull();
      expect(await isBudgetExceeded()).toBe(true);
    }
    reply = { data: 1, error: null };
    expect(await isBudgetExceeded()).toBe(false);
  });

  it("fails closed with no ceiling set, or a ceiling that is not a positive number", async () => {
    for (const v of ["", "0", "-5", "abc"]) {
      vi.stubEnv("AI_MONTHLY_BUDGET_USD", v);
      expect(await isBudgetExceeded(), v).toBe(true);
    }
  });

  it("caches a good total for a minute", async () => {
    reply = { data: 3, error: null };
    await getMonthlySpend();
    reply = { data: 99, error: null };
    expect(await getMonthlySpend()).toBe(3);
    expect(calls).toHaveLength(1);
  });
});
