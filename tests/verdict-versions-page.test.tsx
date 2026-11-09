// Arthur, 2026-11-07, Gate 4 item 5, option (ii): no score change shown
// where the two verdicts' prompt versions differ. The whole verdict page,
// rendered from rows as the database gives them: the revision through
// debates_public, which drops a withheld verdict's prompt_version unless it
// reads v<n> (migration 0023), so the page must compare the rows' own
// prompt_version columns. Adapted from the review of #101, which found
// 318 same-version sample revisions losing their table.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withheldVerdict } from "../src/lib/verdict-privacy";

type Row = Record<string, unknown>;
const db: { tables: Record<string, Row[]>; shares: string[] } = { tables: {}, shares: [] };

// Enough of supabase-js for this page: `eq` and `in` filters, only the
// selected columns returned, as a list or by maybeSingle.
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let columns: string[] | null = null;
  const b: Record<string, unknown> = {};
  for (const m of ["or", "limit", "order", "not"]) b[m] = () => b;
  b.select = (cols: string) => ((columns = cols.split(",").map((c) => c.trim())), b);
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  const rows = () =>
    (db.tables[table] ?? [])
      .filter((r) => filters.every((f) => f(r)))
      .map((r) => (columns ? Object.fromEntries(columns.filter((c) => c in r).map((c) => [c, r[c]])) : r));
  b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows(), error: null });
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({ isAdminConfigured: () => true, createAdminClient: () => ({ from }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from }),
}));
vi.mock("@/lib/analytics/client", () => ({ track: () => {} }));
vi.mock("@/lib/verdict-share", async (original) => {
  const m = await original<typeof import("../src/lib/verdict-share")>();
  return {
    ...m,
    verdictShareLine: (...args: Parameters<typeof m.verdictShareLine>) => {
      const line = m.verdictShareLine(...args);
      db.shares.push(line);
      return line;
    },
  };
});
const { default: VerdictPage } = await import("../src/app/debate/[slug]/[debateId]/page");

const judged = (version: string, score: number, extra: Row = {}) => ({
  rejected: false, score, fidelity: 7, rigor: 7, engagement: 5,
  strongest_move: "s", weakest_move: "w", a_stronger_version_would: "a", verdict_line: "A line.",
  improvement_note: "Better.", unanswered_objection: { school: "utilitarianism", claim: "c", why_it_stands: "y" },
  prompt_version: version, ...extra,
});

async function page(o: { first: string; revision: string; revisionPublic: boolean; sample: boolean }) {
  const verdict = judged(o.revision, 74, { objection_answered: true });
  db.shares = [];
  db.tables = {
    debates_public: [
      {
        id: "r1", topic_slug: "opaque-benefit", school: "stoicism", score: 74,
        // What the view gives: a private revision's verdict is withheld.
        verdict: o.revisionPublic ? verdict : withheldVerdict(verdict),
        elo_before: 1200, elo_after: 1200, argument: o.revisionPublic ? "words" : null, kind: "revision",
        parent_debate_id: "o1", created_at: "2026-11-05T10:00:00Z", motion_text: null,
        is_sample: o.sample, verdict_is_template: o.sample,
      },
    ],
    debate_topics: [{ slug: "opaque-benefit", motion: "A motion.", micro_after: "none" }],
    debates: [
      { id: "o1", verdict: judged(o.first, 61), argument_public: true, prompt_version: o.first },
      { id: "r1", verdict, argument_public: o.revisionPublic, prompt_version: o.revision },
    ],
  };
  const element = await VerdictPage({
    params: Promise.resolve({ slug: "opaque-benefit", debateId: "r1" }),
    searchParams: Promise.resolve({}),
  });
  const html = renderToStaticMarkup(element).replace(/&#x27;/g, "'");
  // What the page hands Verdict, a client component: its props are the
  // page's payload, whether or not they are shown.
  const children = ([] as unknown[]).concat((element as { props: { children: unknown } }).props.children);
  const verdictProps = (children.find((c) => (c as { props?: Row } | null)?.props && "comparison" in (c as { props: Row }).props) as { props: Row }).props;
  return {
    html,
    handed: verdictProps.comparison as { comparable: boolean; first: Record<string, unknown> } | null,
    // A sample's revision reads "the first attempt", a reader's "your".
    table: /Compared with (your|the) first attempt/.test(html),
    line: html.includes("The first attempt was judged by an earlier version of the judge"),
    firstScore: /\b61\b/.test(html),
    share: db.shares.at(-1) ?? "",
  };
}

describe("the verdict page compares a revision with its original only within one version", () => {
  it("within v2, public or private: the table, and the share line's first score", async () => {
    for (const revisionPublic of [true, false]) {
      const r = await page({ first: "v2", revision: "v2", revisionPublic, sample: false });
      expect(r.table, String(revisionPublic)).toBe(true);
      expect(r.firstScore).toBe(true);
      expect(r.line).toBe(false);
    }
    expect((await page({ first: "v2", revision: "v2", revisionPublic: true, sample: false })).share).toContain("61");
  });

  it("within one sample template, even when the view drops the version from a withheld verdict", async () => {
    for (const template of ["sample-template-1", "sample-template-2"]) {
      expect((withheldVerdict(judged(template, 74)) as { prompt_version?: unknown } | null)?.prompt_version, template).toBeUndefined();
      for (const revisionPublic of [true, false]) {
        const r = await page({ first: template, revision: template, revisionPublic, sample: true });
        expect(r.table, `${template} ${revisionPublic}`).toBe(true);
        expect(r.line).toBe(false);
      }
    }
  });

  it("from v2 to v3: no table, no first score, the line, and no first score in the share line", async () => {
    for (const revisionPublic of [true, false]) {
      const r = await page({ first: "v2", revision: "v3", revisionPublic, sample: false });
      expect(r.table, String(revisionPublic)).toBe(false);
      expect(r.firstScore).toBe(false);
      expect(r.line).toBe(true);
      expect(r.html).toContain("Objection answered.");
      expect(r.html).toContain('href="/debate/opaque-benefit/o1"');
    }
    // The first scores are not handed to the client component at all.
    const across = await page({ first: "v2", revision: "v3", revisionPublic: true, sample: false });
    expect(across.handed?.comparable).toBe(false);
    expect(Object.values(across.handed!.first).every((v) => v === null)).toBe(true);
    const within = await page({ first: "v2", revision: "v2", revisionPublic: true, sample: false });
    expect(within.handed?.first.score).toBe(61);
    const shared = await page({ first: "v2", revision: "v3", revisionPublic: true, sample: false });
    expect(shared.share).not.toContain("61");
    expect(shared.share).not.toContain("→");
  });

  it("between two sample templates: no table and no first score, and not called two versions of the judge", async () => {
    const r = await page({ first: "sample-template-1", revision: "sample-template-2", revisionPublic: true, sample: true });
    expect(r.table).toBe(false);
    // Not in what the page hands the component either.
    expect(r.html).not.toMatch(/\b61\b/);
    expect(r.firstScore).toBe(false);
    expect(r.line).toBe(false);
    expect(r.html).not.toContain("version of the judge");
    expect(r.html).toContain("Objection answered.");
  });
});
