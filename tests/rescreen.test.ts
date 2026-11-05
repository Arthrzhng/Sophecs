// The re-screening job for arena replies left pending (Arthur's ruling of
// 2026-11-05 on Checkpoint B, (d) 4): src/lib/rescreen.ts, run once a day
// by /api/cron/rescreen. The same rules as the turn route, so it never
// delivers what the route would not.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let returning = false;
  let head = false;
  let limit = Infinity;
  let order: string | null = null;
  const rows = () => {
    let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (order) out = [...out].sort((a, b) => (String(a[order!]) < String(b[order!]) ? -1 : 1));
    return out.slice(0, limit);
  };
  const b: Record<string, unknown> = {};
  b.select = (_c?: string, o?: { head?: boolean }) => {
    if (patch) returning = true;
    if (o?.head) head = true;
    return b;
  };
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.lt = (c: string, v: string) => (filters.push((r) => String(r[c]) < v), b);
  b.gte = (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b);
  b.order = (c: string) => ((order = c), b);
  b.limit = (n: number) => ((limit = n), b);
  b.update = (p: Row) => ((patch = p), b);
  b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch) {
      const hit = rows();
      for (const r of hit) Object.assign(r, patch);
      return resolve({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
    }
    if (head) return resolve({ count: rows().length, error: null });
    return resolve({ data: rows(), error: null });
  };
  return b;
}
const admin = { from: query } as never;

const { rescreenPending, RESCREEN_BATCH } = await import("../src/lib/rescreen");
const { SCREEN_DAILY_CAP } = await import("../src/lib/screen");

const NOW = new Date("2026-11-06T05:43:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const ok = async () => ({ result: "ok" as const, reason: "", latencyMs: 1, costUsd: 0.0006 });
const deps = (over: Record<string, unknown> = {}) => ({
  screen: ok,
  budget: async () => "ok" as const,
  killed: () => false,
  now: () => NOW,
  ...over,
});
const turn = (id: string, extra: Row = {}) => ({
  id, exchange_id: "x1", author_id: "a", seq: 2, quoted_claim: "A quoted sentence.", body: "A reply.",
  screen_result: "pending", created_at: ago(120), ...extra,
});

beforeEach(() => {
  tables.turns = [turn("t1")];
  tables.exchanges = [{ id: "x1", user_a: "a", user_b: "b", status: "open", next_turn: "a", last_turn_at: null }];
  tables.ai_calls = [];
});

describe("rescreenPending", () => {
  it("delivers a pending reply the screen passes, and hands the turn over", async () => {
    const r = await rescreenPending(admin, deps());
    expect(r).toMatchObject({ read: 1, delivered: 1, held: 0, waiting: 0, stranded: 0 });
    expect(tables.turns[0].screen_result).toBe("ok");
    expect(tables.exchanges[0]).toMatchObject({ next_turn: "b", status: "open", last_turn_at: NOW.toISOString() });
  });

  it("closes the exchange on its last reply, as the route does", async () => {
    tables.turns[0].seq = 4;
    await rescreenPending(admin, deps());
    expect(tables.exchanges[0]).toMatchObject({ next_turn: null, status: "complete" });
  });

  it("holds a reply the screen flags, and does not deliver it", async () => {
    const r = await rescreenPending(admin, deps({ screen: async () => ({ result: "personal_info", reason: "names a school", latencyMs: 1, costUsd: 0 }) }));
    expect(r).toMatchObject({ held: 1, delivered: 0 });
    expect(tables.turns[0]).toMatchObject({ screen_result: "flagged", screen_reason: "personal_info: names a school" });
    expect(tables.exchanges[0].next_turn).toBe("a");
  });

  it("leaves a reply pending when the screen call fails", async () => {
    const r = await rescreenPending(admin, deps({ screen: async () => { throw new Error("down"); } }));
    expect(r).toMatchObject({ waiting: 1, delivered: 0 });
    expect(tables.turns[0].screen_result).toBe("pending");
  });

  it("does nothing while the kill switch is on or the budget is spent or unread", async () => {
    const screen = vi.fn(ok);
    expect(await rescreenPending(admin, deps({ killed: () => true, screen }))).toMatchObject({ stoppedBy: "kill_switch", read: 0 });
    expect(await rescreenPending(admin, deps({ budget: async () => "over", screen }))).toMatchObject({ stoppedBy: "budget" });
    expect(await rescreenPending(admin, deps({ budget: async () => "unread", screen }))).toMatchObject({ stoppedBy: "budget" });
    expect(screen).not.toHaveBeenCalled();
    expect(tables.turns[0].screen_result).toBe("pending");
  });

  it("stops mid-run when the budget runs out, leaving the rest for the next run", async () => {
    tables.turns = [turn("t1", { created_at: ago(300) }), turn("t2", { exchange_id: "x2", created_at: ago(200) })];
    tables.exchanges.push({ id: "x2", user_a: "a", user_b: "c", status: "open", next_turn: "a" });
    let checks = 0;
    // ok for the run's own check and the first reply, then over.
    const r = await rescreenPending(admin, deps({ budget: async () => (++checks <= 2 ? "ok" : "over") }));
    expect(r).toMatchObject({ read: 2, delivered: 1, waiting: 1 });
    expect(tables.turns.find((t) => t.id === "t2")!.screen_result).toBe("pending");
  });

  it("waits for an author at the daily screen cap", async () => {
    tables.ai_calls = Array.from({ length: SCREEN_DAILY_CAP }, (_, i) => ({ id: `c${i}`, user_id: "a", kind: "screen", created_at: ago(60) }));
    const screen = vi.fn(ok);
    const r = await rescreenPending(admin, deps({ screen }));
    expect(r).toMatchObject({ waiting: 1 });
    expect(screen).not.toHaveBeenCalled();
  });

  it("counts only the last 24 hours of the author's screen calls", async () => {
    tables.ai_calls = Array.from({ length: SCREEN_DAILY_CAP }, (_, i) => ({ id: `c${i}`, user_id: "a", kind: "screen", created_at: ago(25 * 60) }));
    expect(await rescreenPending(admin, deps())).toMatchObject({ delivered: 1 });
  });

  it("never delivers into an exchange that is closed or no longer waiting on the author", async () => {
    const screen = vi.fn(ok);
    tables.exchanges[0].status = "complete";
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ stranded: 1, delivered: 0 });
    tables.exchanges[0].status = "open";
    tables.exchanges[0].next_turn = "b";
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ stranded: 1, delivered: 0 });
    expect(screen).not.toHaveBeenCalled();
    expect(tables.turns[0].screen_result).toBe("pending");
  });

  it("leaves a reply the route may still be screening, and takes the oldest first, at most a batch", async () => {
    tables.turns = [
      turn("fresh", { created_at: ago(2) }),
      ...Array.from({ length: RESCREEN_BATCH + 5 }, (_, i) => turn(`old${String(i).padStart(2, "0")}`, { created_at: ago(1000 - i) })),
    ];
    const seen: string[] = [];
    const r = await rescreenPending(admin, deps({ screen: async (p: { body: string }) => (seen.push(p.body), ok()) }));
    expect(r.read).toBe(RESCREEN_BATCH);
    expect(tables.turns.find((t) => t.id === "fresh")!.screen_result).toBe("pending");
  });

  it("does not overwrite a reply decided since it was read", async () => {
    let decided = false;
    const r = await rescreenPending(admin, deps({
      screen: async () => {
        // The route, or another run, decided it meanwhile.
        tables.turns[0].screen_result = "flagged";
        decided = true;
        return ok();
      },
    }));
    expect(decided).toBe(true);
    expect(r).toMatchObject({ delivered: 0, stranded: 1 });
    expect(tables.turns[0].screen_result).toBe("flagged");
    expect(tables.exchanges[0].next_turn).toBe("a");
  });

  it("never touches a sample account's exchange: no screen call, no write", async () => {
    tables.exchanges[0].is_sample = true;
    const screen = vi.fn(ok);
    const before = JSON.stringify(tables);
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ sample: 1, delivered: 0 });
    expect(screen).not.toHaveBeenCalled();
    expect(JSON.stringify(tables)).toBe(before);
  });

  it("passes the reply's own quote and text to the screen, as the route does", async () => {
    const screen = vi.fn(ok);
    await rescreenPending(admin, deps({ screen }));
    expect(screen).toHaveBeenCalledWith({ quotedClaim: "A quoted sentence.", body: "A reply.", userId: "a" });
  });
});

describe("/api/cron/rescreen", () => {
  it("is scheduled once a day, and refuses a call without the cron secret", async () => {
    const fs = await import("node:fs");
    const crons = JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons as { path: string; schedule: string }[];
    expect(crons).toContainEqual({ path: "/api/cron/rescreen", schedule: "43 5 * * *" });
    vi.stubEnv("CRON_SECRET", "s3cret");
    const { GET } = await import("../src/app/api/cron/rescreen/route");
    expect((await GET(new Request("http://x/api/cron/rescreen"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/rescreen", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    vi.unstubAllEnvs();
  });
});
