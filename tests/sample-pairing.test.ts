// When no one else is free, a reader may argue against a sample account
// (Arthur, 2026-11-08, item 1 and the explanation's third sentence):
// pairWithSample, src/app/debate/actions.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorForSeq } from "../src/lib/counterpart";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let signedIn = "";
let unavailable: string | null = null;

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit"]) b[m] = () => b;
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.neq = (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b);
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  b.not = (c: string, _op: string, v: unknown) => (filters.push((r) => (r[c] ?? null) !== v), b);
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
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: signedIn } : null } }) } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/sample-reply", () => ({
  samplesUnavailable: async () => unavailable,
  sampleReplyMessage: (r: string) => (r === "ceiling" ? "Sample accounts have stopped replying for this month." : "Sample accounts are not replying right now."),
}));

const { pairWithSample } = await import("../src/app/debate/actions");

const judged = { kind: "original", rejected: false, verdict: { score: 60 }, topic_slug: "no-decision", argument: "words" };

beforeEach(() => {
  signedIn = "reader";
  unavailable = null;
  tables.exchanges = [];
  tables.debates = [
    { id: "mine", user_id: "reader", school: "stoicism", seeking_counterpart_at: "2026-11-09T01:00:00Z", is_sample: false, ...judged },
    { id: "s-same", user_id: "sample-1", school: "stoicism", is_sample: true, ...judged },
    { id: "s-other-motion", user_id: "sample-2", school: "ubuntu", is_sample: true, ...judged, topic_slug: "opaque-benefit" },
    { id: "s-rejected", user_id: "sample-3", school: "ubuntu", is_sample: true, ...judged, rejected: true },
    { id: "s-unjudged", user_id: "sample-4", school: "ubuntu", is_sample: true, ...judged, verdict: null },
    { id: "s-ok", user_id: "sample-5", school: "ubuntu", is_sample: true, ...judged },
    { id: "h-waiting", user_id: "human", school: "buddhist", is_sample: false, seeking_counterpart_at: "2026-11-09T00:00:00Z", ...judged },
  ];
});

describe("pairWithSample", () => {
  it("pairs the reader with a sample's judged original on the same motion from another school, the reader opening", async () => {
    const out = await pairWithSample("mine");
    expect(out.ok).toBe(true);
    const ex = tables.exchanges[0];
    expect(ex).toMatchObject({ debate_a: "mine", debate_b: "s-ok", user_a: "reader", user_b: "sample-5", school_a: "stoicism", school_b: "ubuntu", next_turn: "reader" });
    // The reader takes turn 1, as the turn route requires.
    expect(authorForSeq(1, ex.user_a as string, ex.user_b as string)).toBe(ex.next_turn);
    // No longer waiting for a person; nobody else's seeking is touched.
    expect(tables.debates.find((d) => d.id === "mine")!.seeking_counterpart_at).toBeNull();
    expect(tables.debates.find((d) => d.id === "h-waiting")!.seeking_counterpart_at).not.toBeNull();
    // Never a person's argument.
    expect(ex.debate_b).not.toBe("h-waiting");
  });

  it("pairs nobody while samples cannot reply, and says why plainly", async () => {
    unavailable = "ceiling";
    expect(await pairWithSample("mine")).toEqual({ ok: false, error: "Sample accounts have stopped replying for this month." });
    expect(tables.exchanges).toHaveLength(0);
  });

  it("refuses another reader's debate, a sample's, a revision and a debate already in an exchange", async () => {
    signedIn = "someone-else";
    expect((await pairWithSample("mine")).ok).toBe(false);
    signedIn = "reader";
    tables.debates.push({ id: "rev", user_id: "reader", school: "stoicism", is_sample: false, ...judged, kind: "revision" });
    expect((await pairWithSample("rev")).ok).toBe(false);
    signedIn = "";
    expect((await pairWithSample("mine")).ok).toBe(false);
    signedIn = "reader";
    tables.exchanges.push({ id: "x0", debate_a: "mine", debate_b: "h-waiting", user_a: "reader", user_b: "human", status: "open" });
    expect(await pairWithSample("mine")).toEqual({ ok: true, exchangeId: "x0" });
    expect(tables.exchanges).toHaveLength(1);
  });

  it("does not pair the reader with a sample already in an open exchange with them, and says so when none is left", async () => {
    tables.exchanges.push({ id: "x1", debate_a: "other", debate_b: "s-ok", user_a: "reader", user_b: "sample-5", status: "open" });
    expect(await pairWithSample("mine")).toEqual({ ok: false, error: "No sample account has argued this motion from another school yet." });
  });
});
