// /api/judge's daily call ceiling and budget, run rather than read: POST
// is called with the database, the session and the budget mocked, and the
// model replaced by a stub that records being reached. Arthur's rulings of
// 2026-11-05 on Checkpoint A, items 6 and 7 (docs/decisions.md, "The
// judge's caps and budget (migration 0026)").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => {
        throw new Error("the model must not be called in this test");
      },
    };
  },
}));

// Reaching judgeDebate is reaching the model. It fails, so the route
// answers "judging failed" and stops there.
const judged: string[] = [];
vi.mock("@/lib/anthropic", async (orig) => ({
  ...(await orig<typeof import("../src/lib/anthropic")>()),
  judgeDebate: async (input: { debateId: string }) => {
    judged.push(input.debateId);
    throw new Error("stub: stop after the model is reached");
  },
}));

// The database: the two counts the route takes on ai_calls are told apart
// by their filters, the cap's carrying counts_toward_cap.
let capCount = 0;
let ceilingCount = 0;
let capError: { message: string } | null = null;
let ceilingError: { message: string } | null = null;
const touched: string[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const filters: string[] = [];
      let op = "select";
      const b: Record<string, unknown> = {};
      for (const m of ["select", "gte", "order", "limit", "in", "neq"]) b[m] = () => b;
      b.eq = (col: string) => (filters.push(col), b);
      b.insert = () => ((op = "insert"), touched.push(`${table}:insert`), b);
      b.update = () => ((op = "update"), touched.push(`${table}:update`), b);
      b.maybeSingle = async () => {
        touched.push(`${table}:read`);
        if (table === "profiles") return { data: { school: "stoicism", elo: 1200, streak: 0, streak_updated_on: null } };
        if (table === "debate_topics") return { data: { slug: "t1", motion: "This house would test it.", active: true, par_elo: 1200 } };
        return { data: null };
      };
      b.then = (resolve: (v: unknown) => unknown) => {
        if (table === "ai_calls" && op === "select") {
          touched.push(filters.includes("counts_toward_cap") ? "ai_calls:cap" : "ai_calls:ceiling");
          return resolve(filters.includes("counts_toward_cap") ? { count: capCount, error: capError } : { count: ceilingCount, error: ceilingError });
        }
        return resolve({ data: null, count: 0, error: null });
      };
      return b;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "reader-1" } } }) } }),
}));
let budget: "ok" | "over" | "unread" = "ok";
vi.mock("@/lib/budget", () => ({ budgetState: async () => budget, isBudgetExceeded: async () => budget !== "ok" }));

const { POST } = await import("../src/app/api/judge/route");

const argument = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
const send = () =>
  POST(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify({ topicSlug: "t1", argument }) }));

beforeEach(() => {
  capCount = 0;
  ceilingCount = 0;
  capError = null;
  ceilingError = null;
  budget = "ok";
  judged.length = 0;
  touched.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const wrote = () => touched.filter((t) => t.startsWith("debates:insert") || t.startsWith("debates:update"));

describe("/api/judge's daily call ceiling, run", () => {
  it("lets a submission through at 17 calls, when all three of its attempts fit under 20", async () => {
    ceilingCount = 17;
    capCount = 4;
    const res = await send();
    expect(judged).toHaveLength(1);
    expect(wrote()).toEqual(["debates:insert"]);
    expect((await res.json()).reason).not.toBe("call_ceiling");
  });

  it("stops one at 18 calls, before anything is written or sent to the model", async () => {
    ceilingCount = 18;
    capCount = 4;
    const body = await (await send()).json();
    expect(body).toMatchObject({ ok: false, paused: true, reason: "call_ceiling" });
    expect(judged).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  it("stops one when the ceiling cannot be counted, with the cap's message", async () => {
    ceilingError = { message: "boom" };
    const res = await send();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("The daily limit could not be checked, so nothing was sent to the judge.");
    expect(judged).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  it("is checked after the five-argument cap", async () => {
    capCount = 5;
    ceilingCount = 20;
    expect(await (await send()).json()).toMatchObject({ paused: true, reason: "daily_cap" });
    expect(touched).not.toContain("ai_calls:ceiling");
  });

  it("does not apply to an allowlisted reviewer", async () => {
    vi.stubEnv("JUDGE_ALLOWLIST_USER_IDS", "reader-1");
    ceilingCount = 30;
    capCount = 9;
    await send();
    expect(judged).toHaveLength(1);
    expect(touched).not.toContain("ai_calls:ceiling");
  });
});

describe("/api/judge's monthly budget, run", () => {
  it("says the limit could not be checked when the spend could not be read, and sends nothing", async () => {
    budget = "unread";
    const res = await send();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("The spending limit could not be checked, so nothing was sent to the judge.");
    expect(judged).toEqual([]);
    expect(touched).toEqual([]);
  });

  it("pauses for the month when the limit is reached, and sends nothing", async () => {
    budget = "over";
    expect(await (await send()).json()).toMatchObject({ ok: false, paused: true, reason: "budget" });
    expect(judged).toEqual([]);
    expect(touched).toEqual([]);
  });

  it("applies to an allowlisted reviewer too", async () => {
    vi.stubEnv("JUDGE_ALLOWLIST_USER_IDS", "reader-1");
    budget = "over";
    expect(await (await send()).json()).toMatchObject({ paused: true, reason: "budget" });
    expect(judged).toEqual([]);
  });
});
