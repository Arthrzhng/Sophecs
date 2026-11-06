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
const { viewerIsChallengeParty } = await import("../src/lib/challenge");

beforeEach(() => {
  updates.length = 0;
  tables.debate_topics = [{ slug: "no-decision", active: true, sort: 1 }];
  tables.debates = [];
  tables.quiz_results = [
    { id: "r-challenger", user_id: "challenger", quiz_version: 1 },
    { id: "r-challengee", user_id: "challengee", quiz_version: 1 },
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

  it("refuses a party whose result is not saved to their account, as /api/judge would not record their debate", async () => {
    // Quiz taken on one device, signed in on another: the result keeps a
    // null user_id until a claim from its own anon_id.
    tables.quiz_results[1].user_id = null;
    signedIn = "challengee";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Challenge not found." });
  });

  it("refuses a challenge with a v2 side, on any build, until launch (step 4)", async () => {
    tables.quiz_results[1].quiz_version = 2;
    signedIn = "challenger";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Challenge not found." });
    tables.challenges[0].topic_slug = "crash-arithmetic";
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Challenge not found." });
    expect(updates).toEqual([]);
  });

  it("still needs a signed-in reader", async () => {
    signedIn = null;
    expect(await assignChallengeTopic("c1")).toEqual({ ok: false, error: "Not signed in." });
  });
});

describe("viewerIsChallengeParty (who /r/[id] shows Debate them to)", () => {
  const challenger = { anon_id: "anon-a", user_id: "user-a" };
  const challengee = { anon_id: "anon-b", user_id: null };
  it("is true for either side, by cookie or by account", () => {
    expect(viewerIsChallengeParty({ anonId: "anon-a" }, [challengee, challenger])).toBe(true);
    expect(viewerIsChallengeParty({ userId: "user-a" }, [challengee, challenger])).toBe(true);
    expect(viewerIsChallengeParty({ anonId: "anon-b" }, [challengee, challenger])).toBe(true);
  });
  it("is false for anyone else, and for a missing owner row", () => {
    expect(viewerIsChallengeParty({ anonId: "anon-z", userId: "user-z" }, [challengee, challenger])).toBe(false);
    expect(viewerIsChallengeParty({}, [challengee, challenger])).toBe(false);
    expect(viewerIsChallengeParty({ userId: "user-a" }, [null])).toBe(false);
  });
  it("never matches on an absent id", () => {
    expect(viewerIsChallengeParty({ anonId: null, userId: null }, [{ anon_id: null, user_id: null }])).toBe(false);
  });
});
