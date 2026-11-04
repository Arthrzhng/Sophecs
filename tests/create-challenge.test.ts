// createChallenge opens a challenge only from a result its caller owns:
// by the anon_id cookie the quiz was taken under, or by the signed-in
// account the result is saved to. Anyone else could otherwise open a
// challenge in another reader's name.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let cookie: string | undefined;
let signedIn: string | null = null;

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  b.insert = async (row: Row) => {
    tables[table].push(row);
    return { error: null };
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }), isAdminConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: signedIn } : null } }) } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }));

const { createChallenge } = await import("../src/app/actions");

beforeEach(() => {
  cookie = undefined;
  signedIn = null;
  tables.quiz_results = [{ id: "r1", anon_id: "anon-owner", user_id: "user-owner" }];
  tables.challenges = [];
});

describe("createChallenge", () => {
  it("opens a challenge for the browser that took the quiz", async () => {
    cookie = "anon-owner";
    const res = await createChallenge("r1");
    expect(res).toMatchObject({ ok: true });
    expect(tables.challenges).toEqual([{ id: res.id, challenger_result_id: "r1", status: "open" }]);
  });

  it("opens one for the account the result is saved to, on another device", async () => {
    cookie = "anon-elsewhere";
    signedIn = "user-owner";
    expect(await createChallenge("r1")).toMatchObject({ ok: true });
  });

  it("refuses anyone else, writing nothing", async () => {
    cookie = "anon-stranger";
    signedIn = "user-stranger";
    expect(await createChallenge("r1")).toEqual({ ok: false, error: "Unknown result." });
    cookie = undefined;
    signedIn = null;
    expect(await createChallenge("r1")).toEqual({ ok: false, error: "Unknown result." });
    expect(tables.challenges).toEqual([]);
  });

  it("refuses an unknown result the same way", async () => {
    cookie = "anon-owner";
    expect(await createChallenge("nope")).toEqual({ ok: false, error: "Unknown result." });
  });
});
