// assignChallengeTopic fixes a challenge's topic only for one of its two
// parties: the owner of the challenger's result or of the challengee's.
// A signed-in stranger gets the answer a missing challenge gets, and the
// row is not written.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const updates: { table: string; patch: Row; id: unknown }[] = [];
let signedIn: string | null = null;

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.order = () => b;
  b.gte = () => b;
  b.eq = (col: string, v: unknown) => {
    filters.push((r) => r[col] === v);
    return b;
  };
  b.in = (col: string, vs: unknown[]) => {
    filters.push((r) => vs.includes(r[col]));
    return b;
  };
  b.update = (p: Row) => {
    patch = p;
    return b;
  };
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  b.single = async () => ({ data: rows()[0] ?? null });
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch) {
      for (const r of rows()) {
        updates.push({ table, patch, id: r.id });
        Object.assign(r, patch);
      }
      return resolve({ data: null, error: null });
    }
    return resolve({ data: rows(), count: 0, error: null });
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: signedIn } : null } }) } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { assignChallengeTopic } = await import("../src/app/debate/actions");

beforeEach(() => {
  updates.length = 0;
  tables.debate_topics = [{ slug: "no-decision", active: true, sort: 1 }];
  tables.debates = [];
  tables.quiz_results = [
    { id: "r-challenger", user_id: "challenger" },
    { id: "r-challengee", user_id: "challengee" },
  ];
  tables.challenges = [
    { id: "c1", topic_slug: null, challenger_result_id: "r-challenger", challengee_result_id: "r-challengee" },
  ];
});

describe("assignChallengeTopic", () => {
  it("sets the topic for the challenger", async () => {
    signedIn = "challenger";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: true, topicSlug: "no-decision" });
    expect(updates).toEqual([{ table: "challenges", patch: { topic_slug: "no-decision" }, id: "c1" }]);
  });

  it("sets the topic for the challengee", async () => {
    signedIn = "challengee";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: true, topicSlug: "no-decision" });
  });

  it("refuses a signed-in stranger as if the challenge did not exist, and writes nothing", async () => {
    signedIn = "stranger";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Challenge not found." });
    expect(await assignChallengeTopic("missing")).toEqual({ ok: false, error: "Challenge not found." });
    expect(updates).toEqual([]);
    expect(tables.challenges[0].topic_slug).toBeNull();
  });

  it("does not tell a stranger a topic already fixed", async () => {
    tables.challenges[0].topic_slug = "crash-arithmetic";
    signedIn = "stranger";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Challenge not found." });
  });

  it("still needs a signed-in reader", async () => {
    signedIn = null;
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Not signed in." });
  });
});
