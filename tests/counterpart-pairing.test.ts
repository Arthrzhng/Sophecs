// The exchange seekCounterpart opens can take its first turn. The turn
// route (src/app/api/counterpart/turn/route.ts) accepts a turn only from
// next_turn and only from authorForSeq(seq, user_a, user_b); before
// 2026-11-04 the two disagreed on turn 1, so no exchange could start.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorForSeq } from "../src/lib/counterpart";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let signedIn = "";

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit"]) b[m] = () => b;
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.neq = (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b);
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  b.not = (c: string, _op: string, v: unknown) => (filters.push((r) => r[c] !== v), b);
  // "a.eq.X,b.eq.Y"
  b.or = (expr: string) => {
    const parts = expr.split(",").map((p) => p.split(".eq."));
    filters.push((r) => parts.some(([c, v]) => r[c] === v));
    return b;
  };
  b.update = (p: Row) => ((patch = p), b);
  b.insert = async (row: Row) => {
    (tables[table] ??= []).push(row);
    return { error: null };
  };
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch) for (const r of rows()) Object.assign(r, patch);
    return resolve({ data: patch ? null : rows(), error: null });
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: signedIn } } }) } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { seekCounterpart } = await import("../src/app/debate/actions");

const judged = { kind: "original", rejected: false, verdict: { score: 60 }, topic_slug: "no-decision" };

beforeEach(() => {
  tables.exchanges = [];
  tables.blocks = [];
  tables.debates = [
    { id: "d-wait", user_id: "u-wait", school: "utilitarianism", seeking_counterpart_at: "2026-11-01T10:00:00Z", ...judged },
    { id: "d-new", user_id: "u-new", school: "stoicism", seeking_counterpart_at: null, ...judged },
  ];
});

describe("seekCounterpart", () => {
  it("opens an exchange whose first turn the turn route accepts, from the newer seeker", async () => {
    signedIn = "u-new";
    const res = await seekCounterpart("d-new");
    expect(res).toMatchObject({ ok: true });
    const ex = tables.exchanges[0];
    expect(ex.next_turn).toBe(authorForSeq(1, ex.user_a as string, ex.user_b as string));
    expect(ex.next_turn).toBe("u-new");
    // Each side's debate and school are its own.
    expect(ex).toMatchObject({ user_a: "u-new", debate_a: "d-new", school_a: "stoicism", user_b: "u-wait", debate_b: "d-wait", school_b: "utilitarianism" });
    // Turn 2 then belongs to the waiting seeker.
    expect(authorForSeq(2, ex.user_a as string, ex.user_b as string)).toBe("u-wait");
    // Both stop seeking.
    expect(tables.debates.every((d) => d.seeking_counterpart_at === null)).toBe(true);
  });

  it("waits, opening nothing, when nobody else is seeking", async () => {
    tables.debates[0].seeking_counterpart_at = null;
    signedIn = "u-new";
    expect(await seekCounterpart("d-new")).toEqual({ ok: true, exchangeId: null });
    expect(tables.exchanges).toEqual([]);
  });
});
