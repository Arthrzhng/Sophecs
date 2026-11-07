// The re-screening job for arena replies left pending (Arthur's ruling of
// 2026-11-05 on Checkpoint B, (d) 4): src/lib/rescreen.ts, run once a day
// by /api/cron/rescreen. The same rules as the turn route, so it never
// delivers what the route would not.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
// Updates to these tables fail, as a lost connection would.
const failingUpdates = new Set<string>();

// Enough of supabase-js and PostgREST for this module: an inner-joined
// `exchanges!inner(...)` embed on turns, filters on the turn's own
// columns or the embed's (`exchanges.status`), conditional updates that
// return the rows they changed, and head counts.
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let returning = false;
  let head = false;
  let embed = false;
  let limit = Infinity;
  let order: string | null = null;
  const value = (r: Row, c: string) => {
    if (!c.startsWith("exchanges.")) return r[c];
    const ex = (tables.exchanges ?? []).find((e) => e.id === r.exchange_id);
    return ex?.[c.slice("exchanges.".length)];
  };
  const rows = () => {
    let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (embed) out = out.filter((r) => (tables.exchanges ?? []).some((e) => e.id === r.exchange_id));
    if (order) out = [...out].sort((a, b) => (String(a[order!]) < String(b[order!]) ? -1 : 1));
    return out.slice(0, limit);
  };
  const b: Record<string, unknown> = {};
  b.select = (cols?: string, o?: { head?: boolean }) => {
    if (patch) returning = true;
    if (o?.head) head = true;
    if (cols?.includes("exchanges!inner(")) embed = true;
    return b;
  };
  b.eq = (c: string, v: unknown) => (filters.push((r) => value(r, c) === v), b);
  b.not = (c: string, op: string, v: unknown) => (filters.push((r) => !(op === "is" && (value(r, c) ?? null) === v)), b);
  b.lt = (c: string, v: string) => (filters.push((r) => String(value(r, c)) < v), b);
  b.gt = (c: string, v: string) => (filters.push((r) => String(value(r, c)) > v), b);
  b.gte = (c: string, v: string) => (filters.push((r) => String(value(r, c)) >= v), b);
  b.order = (c: string) => ((order = c), b);
  b.limit = (n: number) => ((limit = n), b);
  b.update = (p: Row) => ((patch = p), b);
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch && failingUpdates.has(table)) return resolve({ data: null, error: { message: "connection lost" } });
    if (patch) {
      const hit = rows();
      for (const r of hit) Object.assign(r, patch);
      return resolve({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
    }
    if (head) return resolve({ count: rows().length, error: null });
    const out = rows().map((r) => (embed ? { ...r, exchanges: { ...(tables.exchanges ?? []).find((e) => e.id === r.exchange_id) } } : r));
    return resolve({ data: out, error: null });
  };
  return b;
}
const admin = { from: query } as never;

const { rescreenPending, RESCREEN_BATCH, RESCREEN_TIME_BUDGET_MS } = await import("../src/lib/rescreen");
const { SCREEN_DAILY_CAP } = await import("../src/lib/screen");

const NOW = new Date("2026-11-06T05:43:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const ok = async () => ({ result: "ok" as const, reason: "", latencyMs: 1, costUsd: 0.0006 });
const deps = (over: Record<string, unknown> = {}) => ({
  screen: ok,
  budget: async () => "ok" as const,
  killed: () => false,
  now: () => NOW,
  clock: () => 0,
  ...over,
});
// Reply 2 is B's (src/lib/counterpart.ts, authorForSeq), so the author is b.
const turn = (id: string, extra: Row = {}) => ({
  id, exchange_id: "x1", author_id: "b", seq: 2, quoted_claim: "A quoted sentence.", body: "A reply.",
  screen_result: "pending", created_at: ago(120), ...extra,
});
const exchange = (id: string, extra: Row = {}) => ({
  id, user_a: "a", user_b: "b", status: "open", next_turn: "b", is_sample: false, last_turn_at: ago(180), ...extra,
});

beforeEach(() => {
  failingUpdates.clear();
  tables.turns = [turn("t1")];
  tables.exchanges = [exchange("x1")];
  tables.ai_calls = [];
});

describe("rescreenPending", () => {
  it("delivers a pending reply the screen passes, and hands the turn over", async () => {
    const r = await rescreenPending(admin, deps());
    expect(r).toMatchObject({ read: 1, delivered: 1, held: 0, waiting: 0, stranded: 0, failed: 0 });
    expect(tables.turns[0].screen_result).toBe("ok");
    expect(tables.exchanges[0]).toMatchObject({ next_turn: "a", status: "open", last_turn_at: NOW.toISOString() });
  });

  it("closes the exchange on its last reply, as the route does", async () => {
    Object.assign(tables.turns[0], { seq: 4 });
    await rescreenPending(admin, deps());
    expect(tables.exchanges[0]).toMatchObject({ next_turn: null, status: "complete" });
  });

  it("holds a reply the screen flags, and does not deliver it", async () => {
    const r = await rescreenPending(admin, deps({ screen: async () => ({ result: "personal_info", reason: "names a school", latencyMs: 1, costUsd: 0 }) }));
    expect(r).toMatchObject({ held: 1, delivered: 0 });
    expect(tables.turns[0]).toMatchObject({ screen_result: "flagged", screen_reason: "personal_info: names a school" });
    expect(tables.exchanges[0].next_turn).toBe("b");
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
    tables.exchanges.push(exchange("x2"));
    let checks = 0;
    // ok for the run's own check and the first reply, then over.
    const r = await rescreenPending(admin, deps({ budget: async () => (++checks <= 2 ? "ok" : "over") }));
    expect(r).toMatchObject({ read: 2, delivered: 1, waiting: 1 });
    expect(tables.turns.find((t) => t.id === "t2")!.screen_result).toBe("pending");
  });

  it("starts no reply once its time is spent, leaving the rest for the next run", async () => {
    tables.turns = [turn("t1", { created_at: ago(300) }), turn("t2", { exchange_id: "x2", created_at: ago(200) })];
    tables.exchanges.push(exchange("x2"));
    let t = 0;
    const r = await rescreenPending(admin, deps({ clock: () => t, screen: async () => ((t += RESCREEN_TIME_BUDGET_MS + 1), ok()) }));
    expect(r).toMatchObject({ delivered: 1, waiting: 1 });
  });

  it("waits for an author at the daily screen cap", async () => {
    tables.ai_calls = Array.from({ length: SCREEN_DAILY_CAP }, (_, i) => ({ id: `c${i}`, user_id: "b", kind: "screen", created_at: ago(60) }));
    const screen = vi.fn(ok);
    const r = await rescreenPending(admin, deps({ screen }));
    expect(r).toMatchObject({ waiting: 1 });
    expect(screen).not.toHaveBeenCalled();
  });

  it("counts only the last 24 hours of the author's screen calls", async () => {
    tables.ai_calls = Array.from({ length: SCREEN_DAILY_CAP }, (_, i) => ({ id: `c${i}`, user_id: "b", kind: "screen", created_at: ago(25 * 60) }));
    expect(await rescreenPending(admin, deps())).toMatchObject({ delivered: 1 });
  });

  it("never reads a reply it could not deliver: closed, lapsed, sample, or a deleted author", async () => {
    const screen = vi.fn(ok);
    tables.exchanges = [
      exchange("x1", { status: "complete" }),
      exchange("x2", { status: "lapsed", next_turn: null }),
      exchange("x3", { is_sample: true }),
      exchange("x4", { user_b: null, next_turn: null }),
    ];
    tables.turns = [turn("t1"), turn("t2", { exchange_id: "x2" }), turn("t3", { exchange_id: "x3" }), turn("t4", { exchange_id: "x4", author_id: null })];
    const before = JSON.stringify(tables);
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ read: 0, delivered: 0 });
    expect(screen).not.toHaveBeenCalled();
    expect(JSON.stringify(tables)).toBe(before);
  });

  // Arthur, 2026-11-07, Gate 4 item 12: a pending reply holds the lapse
  // clock until it is screened, so a reply saved on day 13 and not checked
  // until day 20 is still delivered, and the clock restarts from then.
  it("delivers a pending reply however long ago the last delivered one was: the reply holds the clock", async () => {
    Object.assign(tables.exchanges[0], { last_turn_at: ago(20 * 24 * 60) });
    Object.assign(tables.turns[0], { created_at: ago(7 * 24 * 60) });
    expect(await rescreenPending(admin, deps())).toMatchObject({ read: 1, delivered: 1 });
    expect(tables.exchanges[0]).toMatchObject({ status: "open", next_turn: "a", last_turn_at: NOW.toISOString() });
  });

  it("does not let replies it cannot deliver fill a run ahead of one it can", async () => {
    tables.exchanges = [exchange("x1", { status: "lapsed", next_turn: null })];
    tables.turns = Array.from({ length: RESCREEN_BATCH + 5 }, (_, i) => turn(`dead${i}`, { created_at: ago(5000 - i) }));
    tables.exchanges.push(exchange("live"));
    tables.turns.push(turn("fine", { exchange_id: "live", created_at: ago(100) }));
    const r = await rescreenPending(admin, deps());
    expect(r).toMatchObject({ read: 1, delivered: 1 });
    expect(tables.turns.find((t) => t.id === "fine")!.screen_result).toBe("ok");
  });

  it("strands a reply that is not its author's turn by sequence or by next_turn", async () => {
    const screen = vi.fn(ok);
    Object.assign(tables.turns[0], { seq: 3 }); // reply 3 is A's
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ stranded: 1 });
    Object.assign(tables.turns[0], { seq: 2 });
    Object.assign(tables.exchanges[0], { next_turn: "a" });
    expect(await rescreenPending(admin, deps({ screen }))).toMatchObject({ stranded: 1 });
    expect(screen).not.toHaveBeenCalled();
    expect(tables.turns[0].screen_result).toBe("pending");
  });

  it("puts a reply back to pending when the exchange moved on during the screen", async () => {
    const r = await rescreenPending(admin, deps({
      screen: async () => {
        Object.assign(tables.exchanges[0], { status: "lapsed", next_turn: null });
        return ok();
      },
    }));
    expect(r).toMatchObject({ delivered: 0, failed: 1 });
    expect(tables.turns[0].screen_result).toBe("pending");
    expect(tables.exchanges[0]).toMatchObject({ status: "lapsed", next_turn: null });
  });

  it("reports a reply it could not put back as stuck, apart from one it could", async () => {
    let call = 0;
    // The hand-over fails; then the revert fails too.
    const r = await rescreenPending(admin, deps({
      screen: async () => {
        Object.assign(tables.exchanges[0], { next_turn: "a" });
        return ok();
      },
    }));
    expect(r).toMatchObject({ failed: 1, stuck: 0 });
    expect(tables.turns[0].screen_result).toBe("pending");
    Object.assign(tables.exchanges[0], { next_turn: "b" });
    const r2 = await rescreenPending(admin, deps({
      screen: async () => {
        call++;
        failingUpdates.add("exchanges");
        return ok();
      },
    }));
    // The turn was set ok before the exchange update failed; the revert
    // then succeeded, so this one is failed, not stuck.
    expect(call).toBe(1);
    expect(r2).toMatchObject({ failed: 1, stuck: 0 });
    expect(tables.turns[0].screen_result).toBe("pending");
  });

  it("counts a reply left visible when neither the hand-over nor the revert would take", async () => {
    let turnUpdates = 0;
    const r = await rescreenPending(admin, deps({
      screen: async () => {
        failingUpdates.add("exchanges");
        return ok();
      },
    }));
    expect(r.failed).toBe(1);
    // Now fail the turns table after its first update (the ok), so the revert fails.
    tables.turns[0].screen_result = "pending";
    failingUpdates.clear();
    const origFrom = (admin as unknown as { from: (t: string) => unknown }).from;
    const wrapped = {
      from: (t: string) => {
        const q = origFrom(t) as Record<string, unknown>;
        if (t !== "turns") return q;
        const update = q.update as (p: Row) => unknown;
        q.update = (p: Row) => {
          turnUpdates++;
          if (turnUpdates === 2) failingUpdates.add("turns");
          return update(p);
        };
        return q;
      },
    } as never;
    const r2 = await rescreenPending(wrapped, deps({
      screen: async () => {
        failingUpdates.add("exchanges");
        return ok();
      },
    }));
    expect(r2).toMatchObject({ stuck: 1, failed: 0 });
    expect(tables.turns[0].screen_result).toBe("ok");
  });

  it("takes the oldest first, and screens at most a batch a run", async () => {
    tables.exchanges = Array.from({ length: RESCREEN_BATCH + 5 }, (_, i) => exchange(`x${i}`));
    tables.turns = [
      turn("fresh", { exchange_id: "x0", created_at: ago(2) }),
      ...Array.from({ length: RESCREEN_BATCH + 4 }, (_, i) => turn(`t${i + 1}`, { exchange_id: `x${i + 1}`, body: `reply ${i + 1}`, created_at: ago(1000 - i) })),
    ];
    const seen: string[] = [];
    const r = await rescreenPending(admin, deps({ screen: async (p: { body: string }) => (seen.push(p.body), ok()) }));
    expect(seen).toEqual(Array.from({ length: RESCREEN_BATCH }, (_, i) => `reply ${i + 1}`));
    expect(r).toMatchObject({ delivered: RESCREEN_BATCH, waiting: 4 });
    expect(tables.turns.find((t) => t.id === "fresh")!.screen_result).toBe("pending");
  });

  it("does not overwrite a reply decided since it was read", async () => {
    const r = await rescreenPending(admin, deps({
      screen: async () => {
        tables.turns[0].screen_result = "flagged";
        return ok();
      },
    }));
    expect(r).toMatchObject({ delivered: 0, stranded: 1 });
    expect(tables.turns[0].screen_result).toBe("flagged");
    expect(tables.exchanges[0].next_turn).toBe("b");
  });

  it("passes the reply's own quote and text to the screen, as the route does", async () => {
    const screen = vi.fn(ok);
    await rescreenPending(admin, deps({ screen }));
    expect(screen).toHaveBeenCalledWith({ quotedClaim: "A quoted sentence.", body: "A reply.", userId: "b" });
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

describe("what the author of a pending reply is told", () => {
  it("is the same sentence on the composer and on the exchange page, and says the check is retried", async () => {
    const { REPLY_SAVED_COPY } = await import("../src/lib/counterpart");
    expect(REPLY_SAVED_COPY).toBe(
      "Your reply is saved and will be delivered once it has been checked. A check that could not run is tried again once a day."
    );
    const fs = await import("node:fs");
    expect(fs.readFileSync("src/components/counterpart/TurnComposer.tsx", "utf8")).toContain("{REPLY_SAVED_COPY}");
    expect(fs.readFileSync("src/components/counterpart/ExchangeView.tsx", "utf8")).toContain("{REPLY_SAVED_COPY}");
  });

  it("locks the composer only on the reader's own latest reply, while it is pending", async () => {
    const { latestReplyPending } = await import("../src/lib/counterpart");
    const t = (author_id: string | null, screen_result: string) => ({ author_id, screen_result });
    expect(latestReplyPending([t("a", "ok"), t("b", "pending")], "b")).toBe(true);
    expect(latestReplyPending([t("a", "ok"), t("b", "ok")], "b")).toBe(false);
    // An older pending reply the exchange moved past does not lock the reader out.
    expect(latestReplyPending([t("a", "ok"), t("b", "pending"), t("a", "ok")], "b")).toBe(false);
    // Nor does the other reader's pending reply.
    expect(latestReplyPending([t("a", "pending")], "b")).toBe(false);
    expect(latestReplyPending([], "b")).toBe(false);
  });

  it("shows a pending reply as waiting, not held, and offers no second reply while it waits", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { ExchangeView } = await import("../src/components/counterpart/ExchangeView");
    const base = {
      exchangeId: "x", userId: "b", topicSlug: "t", myDebateId: "d", motion: "A motion.",
      mySchool: "stoicism", theirSchool: "utilitarianism", myArgument: "Mine.", theirArgument: "Theirs.",
      counterpartLeft: false, anyRemoved: false, myHeld: false, status: "open", myTurn: false,
      nextSeq: 3, sourceLabel: "", sourceText: "", publishMine: false, publishTheirs: false,
    };
    const pendingTurn = { id: "t2", seq: 2, mine: true, quotedClaim: "Q.", body: "B.", held: false, pending: true };
    const html = renderToStaticMarkup(createElement(ExchangeView, { ...base, turns: [pendingTurn], myPending: true } as never));
    expect(html).toContain("waiting to be checked");
    expect(html).not.toContain("held for review");
    expect(html).toContain("A check that could not run is tried again once a day.");
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/counterpart/[id]/page.tsx", "utf8");
    expect(page).toContain("nextSeq <= MAX_SEQ && !myPending;");
    expect(page).toContain("const myPending = latestReplyPending(turns, user.id);");
  });
});
