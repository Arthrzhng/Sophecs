// A page showing a sample passes no referrer on (Arthur, 2026-11-05:
// "no-referrer policy on sample pages"): its metadata carries
// `referrer: "no-referrer"`, which Next.js renders as
// <meta name="referrer" content="no-referrer">. A reader's own pages do
// not, so their referrers are as before.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const pick = (row: Row, cols: string) =>
  Object.fromEntries(cols.split(",").map((c) => c.trim()).map((c) => [c, row[c]]));

vi.mock("@/lib/supabase/admin", () => ({
  isAdminConfigured: () => true,
  createAdminClient: () => ({
    from: (t: string) => ({
      select: (cols: string) => ({
        eq: (col: string, v: unknown) => {
          const found = (tables[t] ?? []).find((r) => r[col] === v);
          const row = found && pick(found, cols);
          return {
            single: async () => (row ? { data: row, error: null } : { data: null, error: { code: "PGRST116" } }),
            maybeSingle: async () => ({ data: row ?? null, error: null }),
          };
        },
      }),
    }),
  }),
}));

const result = (await import("../../src/app/r/[id]/page")).generateMetadata;
const challenge = (await import("../../src/app/c/[id]/page")).generateMetadata;
const verdict = (await import("../../src/app/debate/[slug]/[debateId]/page")).generateMetadata;
const { sampleMetadata, SAMPLE_PAGE_REFERRER } = await import("../../src/lib/sample");

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const pv = (debateId: string) => ({ params: Promise.resolve({ debateId }) });

beforeEach(() => {
  const res = { school: "stoicism", secondary: "utilitarianism", vector: {}, challenge_from: null, created_at: "2026-11-05T00:00:00Z" };
  tables.public_results = [
    { id: "r-sample", ...res, is_sample: true },
    { id: "r-genuine", ...res, is_sample: false },
  ];
  tables.challenges = [
    { id: "c-sample", challenger_result_id: "r-sample", is_sample: true },
    { id: "c-genuine", challenger_result_id: "r-genuine", is_sample: false },
  ];
  tables.debates_public = [
    { id: "d-sample", is_sample: true },
    { id: "d-genuine", is_sample: false },
  ];
});

describe("the referrer a page passes on", () => {
  it("is none from a sample's result, challenge or verdict", async () => {
    expect(SAMPLE_PAGE_REFERRER).toBe("no-referrer");
    expect(sampleMetadata("x").referrer).toBe("no-referrer");
    expect(await result(p("r-sample"))).toMatchObject({ referrer: "no-referrer" });
    expect(await challenge(p("c-sample"))).toMatchObject({ referrer: "no-referrer" });
    expect(await verdict(pv("d-sample"))).toMatchObject({ referrer: "no-referrer" });
  });

  it("is left as it was on a reader's own pages", async () => {
    for (const m of [await result(p("r-genuine")), await challenge(p("c-genuine")), await verdict(pv("d-genuine"))]) {
      expect(m).not.toHaveProperty("referrer");
    }
  });
});
