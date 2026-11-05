// Every reader of a quiz result knows its version (Stage 5, step 3;
// migration 0027; src/lib/quiz-result.ts). A v2 result is not found on a
// build without SIX_SCHOOLS, gives nothing a school on any build, and is
// never compared weight for weight with a v1 result.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comparable, quizVersionOf, schoolFromResult, shownOnThisBuild, PUBLIC_RESULT_COLUMNS } from "../src/lib/quiz-result";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

// Enough of supabase-js for these readers: filters, newest-first order,
// a limit, the three terminal reads, and update/insert on profiles.
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let order: { col: string; asc: boolean } | null = null;
  let limit = Infinity;
  let patch: Row | null = null;
  const rows = () => {
    let out = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (order) {
      const { col, asc } = order;
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
    }
    return out.slice(0, limit);
  };
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.is = (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b);
  b.or = () => b;
  b.neq = () => b;
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  b.order = (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), b);
  b.limit = (n: number) => ((limit = n), b);
  b.update = (p: Row) => ((patch = p), b);
  b.insert = async (row: Row) => (tables[table].push({ ...row }), { error: null });
  b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  b.single = async () => (rows()[0] ? { data: rows()[0], error: null } : { data: null, error: { code: "PGRST116" } });
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch) {
      for (const r of rows()) Object.assign(r, patch);
      return resolve({ data: null, error: null });
    }
    return resolve({ data: rows(), error: null });
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }), isAdminConfigured: () => true }));
vi.mock("@/lib/fonts", () => {
  const font = { className: "", variable: "", style: {} };
  return { spectral: font, plexSans: font, plexMono: font, bricolage: font };
});

const resultPage = await import("../src/app/r/[id]/page");
const challengePage = await import("../src/app/c/[id]/page");
const ogImage = (await import("../src/app/r/[id]/opengraph-image")).default;
const cardPng = (await import("../src/app/r/[id]/card.png/route")).GET;
const { claimAnonymousResults } = await import("../src/lib/claim");
const { getPendingChallenges } = await import("../src/lib/challenge");

const V = { stoicism: 0.5, utilitarianism: 0.3, "virtue-ethics": 0.2 };
const v1 = (id: string, school: string, created_at: string, extra: Row = {}) => ({
  id, school, secondary: null, vector: V, challenge_from: null, created_at, is_sample: false,
  quiz_version: 1, map_x: null, map_y: null, anon_id: `anon-${id}`, user_id: null, ...extra,
});
const v2 = (id: string, school: string, created_at: string, extra: Row = {}) => ({
  ...v1(id, school, created_at, extra), vector: null, quiz_version: 2, map_x: -0.4, map_y: 0.3, ...extra,
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });

const flag = process.env.SIX_SCHOOLS;
afterEach(() => {
  if (flag === undefined) delete process.env.SIX_SCHOOLS;
  else process.env.SIX_SCHOOLS = flag;
});

describe("the version rules", () => {
  it("knows versions 1 and 2 and nothing else", () => {
    expect(quizVersionOf({ quiz_version: 1 })).toBe(1);
    expect(quizVersionOf({ quiz_version: 2 })).toBe(2);
    for (const v of [undefined, null, 0, 3, "1"]) expect(quizVersionOf({ quiz_version: v })).toBeNull();
  });

  it("shows a v1 result on every build and a v2 one only with SIX_SCHOOLS", () => {
    process.env.SIX_SCHOOLS = "0";
    expect(shownOnThisBuild({ quiz_version: 1 })).toBe(true);
    expect(shownOnThisBuild({ quiz_version: 2 })).toBe(false);
    expect(shownOnThisBuild({})).toBe(false);
    process.env.SIX_SCHOOLS = "1";
    expect(shownOnThisBuild({ quiz_version: 2 })).toBe(true);
    expect(shownOnThisBuild({ quiz_version: 3 })).toBe(false);
  });

  it("takes a school from a v1 result only, on every build", () => {
    for (const f of ["0", "1"]) {
      process.env.SIX_SCHOOLS = f;
      expect(schoolFromResult({ quiz_version: 1, school: "stoicism" })).toBe("stoicism");
      expect(schoolFromResult({ quiz_version: 2, school: "ubuntu" })).toBeNull();
      expect(schoolFromResult({ school: "stoicism" })).toBeNull();
    }
  });

  it("compares two v1 results only", () => {
    expect(comparable({ quiz_version: 1 }, { quiz_version: 1 })).toBe(true);
    expect(comparable({ quiz_version: 1 }, { quiz_version: 2 })).toBe(false);
    expect(comparable({ quiz_version: 2 }, { quiz_version: 2 })).toBe(false);
  });

  it("reads every column migration 0027 adds to public_results", () => {
    for (const c of ["quiz_version", "map_x", "map_y"]) expect(PUBLIC_RESULT_COLUMNS).toContain(c);
  });
});

describe("the pages and images", () => {
  beforeEach(() => {
    // A v2 result can be in any of the six schools; r3's is a live one, so
    // the flag-on case below needs no draft content, which loads at import.
    tables.public_results = [v1("r1", "stoicism", "2026-11-01"), v2("r2", "ubuntu", "2026-11-02"), v2("r3", "virtue-ethics", "2026-11-02")];
    tables.challenges = [
      { id: "c1", challenger_result_id: "r1", is_sample: false },
      { id: "c2", challenger_result_id: "r2", is_sample: false },
    ];
  });

  // The page's metadata reads the result through the same getResult as the
  // page body, which also needs a request's cookies to render.
  it("answers a v2 result as not found without SIX_SCHOOLS, in the page, the challenge and both images", async () => {
    process.env.SIX_SCHOOLS = "0";
    expect(await resultPage.generateMetadata(p("r2"))).toEqual({ title: "Sophecs" });
    expect(await resultPage.generateMetadata(p("r3"))).toEqual({ title: "Sophecs" });
    await expect(challengePage.default(p("c2"))).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    expect((await ogImage(p("r2"))).status).toBe(404);
    expect((await cardPng(new Request("http://x"), p("r2"))).status).toBe(404);
  });

  it("shows a v1 result as before", async () => {
    process.env.SIX_SCHOOLS = "0";
    expect(await resultPage.generateMetadata(p("r1"))).toMatchObject({ title: "Stoicism · Sophecs" });
  });

  it("finds a v2 result on a SIX_SCHOOLS build", async () => {
    process.env.SIX_SCHOOLS = "1";
    expect(await resultPage.generateMetadata(p("r3"))).toMatchObject({ title: "Virtue Ethics · Sophecs" });
  });
});

describe("the claim on sign-in", () => {
  beforeEach(() => {
    tables.profiles = [];
  });

  it("gives a new account the school of its newest v1 result, passing over a newer v2 one", async () => {
    tables.quiz_results = [v1("a", "utilitarianism", "2026-11-01", { anon_id: "me" }), v2("b", "ubuntu", "2026-11-03", { anon_id: "me" })];
    const res = await claimAnonymousResults("u1", "me");
    expect(res).toEqual({ claimed: true, school: "utilitarianism" });
    expect(tables.profiles).toEqual([{ id: "u1", school: "utilitarianism" }]);
    expect(tables.quiz_results.every((r) => r.user_id === "u1")).toBe(true);
  });

  it("claims a v2-only reader's result but gives the account no school", async () => {
    tables.quiz_results = [v2("b", "ubuntu", "2026-11-03", { anon_id: "me" })];
    const res = await claimAnonymousResults("u1", "me");
    expect(res).toEqual({ claimed: true, school: null });
    expect(tables.profiles).toEqual([{ id: "u1", school: null }]);
  });
});

describe("pending challenges on /me", () => {
  it("names the other side's school from a v1 result only", async () => {
    tables.quiz_results = [
      v1("mine", "stoicism", "2026-11-01", { user_id: "u1" }),
      v1("theirs-v1", "virtue-ethics", "2026-11-01"),
      v2("theirs-v2", "buddhist", "2026-11-02"),
    ];
    tables.challenges = [
      { id: "c1", topic_slug: null, status: "accepted", challenger_result_id: "mine", challengee_result_id: "theirs-v1" },
      { id: "c2", topic_slug: null, status: "accepted", challenger_result_id: "mine", challengee_result_id: "theirs-v2" },
    ];
    const pending = await getPendingChallenges({ from: query } as never, "u1");
    expect(pending).toEqual([
      { challengeId: "c1", topicSlug: null, otherSchool: "virtue-ethics" },
      { challengeId: "c2", topicSlug: null, otherSchool: null },
    ]);
  });
});

describe("the share page's comparison", () => {
  const props = {
    resultId: "r1", school: "stoicism" as const, oneLine: "A line.", oneLineAttribution: "Someone",
    isOwner: false, isSavedToProfile: false, showDebateThem: false, challengeId: null,
    isSignedIn: false, shareLine: "A share line.", shareLineIndex: 0,
  };
  // Only the cold-recipient page says how long the quiz takes.
  const COLD = "about eighty seconds";
  const render = async (extra: Record<string, unknown>) => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { SharePage } = await import("../src/components/share/SharePage");
    return renderToStaticMarkup(createElement(SharePage, { ...props, ...extra } as never));
  };

  it("shows both results' weights beside two v1 results, and not the cold-recipient page", async () => {
    const html = await render({ vector: V, otherVector: V, hasOtherResult: true });
    expect(html).toContain("Whoever sent it");
    expect(html).not.toContain(COLD);
  });

  it("shows no weights beside a result from the other version, and still not the cold-recipient page", async () => {
    // /r/[id] on a SIX_SCHOOLS build, a v1 result beside a v2 one: compareWith is null.
    const html = await render({ vector: null, otherVector: null, hasOtherResult: true });
    expect(html).not.toContain("Whoever sent it");
    expect(html).not.toContain("This result");
    expect(html).not.toContain(COLD);
  });

  it("is the cold-recipient page when there is no other result, as on a build that hides the v2 side", async () => {
    const html = await render({ vector: null, otherVector: null, hasOtherResult: false });
    expect(html).toContain(COLD);
    expect(html).not.toContain("Whoever sent it");
  });

  it("works out hasOtherResult from the other vector when a caller passes none, as before", async () => {
    expect(await render({ vector: V, otherVector: V })).toContain("Whoever sent it");
    expect(await render({ vector: V, otherVector: null })).toContain(COLD);
  });
});
