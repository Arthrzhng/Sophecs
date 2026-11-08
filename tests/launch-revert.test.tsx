// The launch's revert (docs/decisions.md, "The launch merge"): production
// built again without SIX_SCHOOLS, after readers and samples have been
// placed in the three. Such a build has no content for them, and getSchool
// throws for a school it does not show, so the pages that take a school
// from a database row must answer with the quiz or a not-found, never an
// error (review pass 1 of #112). With the flag, the same rows render.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db: { tables: Record<string, Row[]>; user: { id: string } | null } = { tables: {}, user: null };

// Enough of supabase-js for these pages: `eq` and `in` filters, the
// selected columns, a list, a count, or maybeSingle.
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let columns: string[] | null = null;
  const b: Record<string, unknown> = {};
  for (const m of ["or", "limit", "order", "not", "gte", "lt", "range", "neq", "is"]) b[m] = () => b;
  b.select = (cols: string) => ((columns = cols.split(",").map((c) => c.trim())), b);
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  const rows = () =>
    (db.tables[table] ?? [])
      .filter((r) => filters.every((f) => f(r)))
      .map((r) => (columns ? Object.fromEntries(columns.filter((c) => c in r).map((c) => [c, r[c]])) : r));
  b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  b.single = async () => ({ data: rows()[0] ?? null, error: null });
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows(), error: null, count: rows().length });
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({ isAdminConfigured: () => true, createAdminClient: () => ({ from }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user } }) }, from }),
}));
vi.mock("@/lib/analytics/client", () => ({ track: () => {} }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function pages(flag: "0" | "1") {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  return {
    verdict: (await import("../src/app/debate/[slug]/[debateId]/page")).default,
    image: (await import("../src/app/debate/[slug]/[debateId]/opengraph-image")).default,
    revise: (await import("../src/app/debate/[slug]/[debateId]/revise/page")).default,
    today: (await import("../src/app/today/page")).default,
  };
}

const verdict = {
  rejected: false, score: 64, fidelity: 7, rigor: 6, engagement: 5,
  strongest_move: "s", weakest_move: "w", a_stronger_version_would: "a", verdict_line: "A line.",
  improvement_note: "Better.", unanswered_objection: { school: "stoicism", claim: "c", why_it_stands: "y" },
  prompt_version: "v3",
};

function rows(school: string) {
  db.user = { id: "u1" };
  db.tables = {
    debates_public: [
      {
        id: "d1", topic_slug: "opaque-benefit", school, score: 64, verdict, elo_before: 1200, elo_after: 1210,
        argument: "words", kind: "original", parent_debate_id: null, created_at: "2026-11-09T10:00:00Z",
        motion_text: null, is_sample: false, verdict_is_template: false,
      },
    ],
    debates: [
      {
        id: "d1", user_id: "u1", kind: "original", rejected: false, verdict, argument: "words", school,
        topic_slug: "opaque-benefit", motion_text: null, prompt_version: "v3", argument_public: true,
      },
    ],
    debate_topics: [{ slug: "opaque-benefit", motion: "A motion.", micro_after: "none", active: true }],
    profiles: [{ id: "u1", school, streak: 0, streak_updated_on: null, elo: 1200 }],
  };
}

const params = Promise.resolve({ slug: "opaque-benefit", debateId: "d1" });

describe("a build without SIX_SCHOOLS, given rows in one of the three", () => {
  it("answers the verdict page, its image and its revision page with a not-found, and /today with the quiz", async () => {
    for (const school of ["confucian", "ubuntu", "buddhist"]) {
      rows(school);
      const p = await pages("0");
      await expect(p.verdict({ params, searchParams: Promise.resolve({}) }), school).rejects.toThrow("NEXT_NOT_FOUND");
      expect((await p.image({ params })).status, school).toBe(404);
      await expect(p.revise({ params }), school).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(p.today(), school).rejects.toThrow("NEXT_REDIRECT /quiz?next=/today");
    }
  });

  it("still renders the verdict page, its image and its revision page for one of the original three", async () => {
    rows("stoicism");
    let p = await pages("0");
    expect((await p.image({ params })).status).toBe(200);
    await expect(p.revise({ params })).resolves.toBeTruthy();
    db.user = null; // a reader, not the author, so no owner-only controls
    p = await pages("0");
    const html = renderToStaticMarkup(await p.verdict({ params, searchParams: Promise.resolve({}) }));
    expect(html).toContain("A line.");
  });

  it("draws the site card's hairline in the original three's colours only", async () => {
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", "0");
    const { SITE_HAIRLINE, SCHOOL_MARKER } = await import("../src/lib/card-tokens");
    expect(SITE_HAIRLINE).toEqual([SCHOOL_MARKER.stoicism, SCHOOL_MARKER.utilitarianism, SCHOOL_MARKER["virtue-ethics"]]);
  });
});

describe("a build with SIX_SCHOOLS, given the same rows", () => {
  it("renders the verdict page and does not send the reader to the quiz", async () => {
    rows("confucian");
    db.user = null;
    const p = await pages("1");
    const html = renderToStaticMarkup(await p.verdict({ params, searchParams: Promise.resolve({}) }));
    expect(html).toContain("A line.");
    db.user = { id: "u1" };
    const today = await p.today().then(
      () => "rendered",
      (e: Error) => e.message
    );
    expect(today).not.toMatch(/NEXT_REDIRECT \/quiz/);
    // The image and the revision page too.
    expect((await p.image({ params })).status).toBe(200);
    await expect(p.revise({ params })).resolves.toBeTruthy();
  });

  it("draws the site card's hairline in all six colours", async () => {
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", "1");
    const { SITE_HAIRLINE } = await import("../src/lib/card-tokens");
    expect(SITE_HAIRLINE).toHaveLength(6);
    expect(new Set(SITE_HAIRLINE).size).toBe(6);
  });
});
