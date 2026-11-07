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

// Enough of supabase-js for this page: equality filters, and maybeSingle
// answering the first row that matches them.
function from(table: string) {
  const filters: [string, unknown][] = [];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "or", "limit", "order", "in", "not"]) b[m] = () => b;
  b.eq = (c: string, v: unknown) => (filters.push([c, v]), b);
  b.maybeSingle = async () => ({ data: (db.tables[table] ?? []).find((r) => filters.every(([c, v]) => r[c] === v)) ?? null });
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
      { id: "r1", prompt_version: o.revision },
    ],
  };
  const element = await VerdictPage({
    params: Promise.resolve({ slug: "opaque-benefit", debateId: "r1" }),
    searchParams: Promise.resolve({}),
  });
  const html = renderToStaticMarkup(element).replace(/&#x27;/g, "'");
  return {
    html,
    table: html.includes("Compared with your first attempt"),
    line: html.includes("The first attempt was judged by an earlier version of the judge"),
    firstScore: html.includes(">61<"),
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
    const shared = await page({ first: "v2", revision: "v3", revisionPublic: true, sample: false });
    expect(shared.share).not.toContain("61");
    expect(shared.share).not.toContain("→");
  });

  it("between two sample templates: no table and no first score, and not called two versions of the judge", async () => {
    const r = await page({ first: "sample-template-1", revision: "sample-template-2", revisionPublic: true, sample: true });
    expect(r.table).toBe(false);
    expect(r.firstScore).toBe(false);
    expect(r.line).toBe(false);
    expect(r.html).not.toContain("version of the judge");
    expect(r.html).toContain("Objection answered.");
  });
});
