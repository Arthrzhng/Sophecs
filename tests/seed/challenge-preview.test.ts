// A sample challenge's link preview (src/app/c/[id]/page.tsx): the
// challenger's result card, which draws the Sample mark, only when that
// result is itself a sample; and the result card routes give no image at
// all, uncached, for a result they cannot read, rather than a default
// card that would carry no mark.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

// The two reads these routes make: .from(t).select(cols).eq(col, v).single().
vi.mock("@/lib/supabase/admin", () => ({
  isAdminConfigured: () => true,
  createAdminClient: () => ({
    from: (t: string) => ({
      select: () => ({
        eq: (col: string, v: unknown) => ({
          single: async () => {
            const row = (tables[t] ?? []).find((r) => r[col] === v);
            return row ? { data: row, error: null } : { data: null, error: { code: "PGRST116" } };
          },
        }),
      }),
    }),
  }),
}));

const { generateMetadata } = await import("../../src/app/c/[id]/page");
const ogImage = (await import("../../src/app/r/[id]/opengraph-image")).default;
const { GET: cardPng } = await import("../../src/app/r/[id]/card.png/route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  tables.challenges = [
    { id: "c-sample", challenger_result_id: "r-sample", is_sample: true },
    { id: "c-sample-genuine-challenger", challenger_result_id: "r-genuine", is_sample: true },
    { id: "c-genuine", challenger_result_id: "r-genuine", is_sample: false },
  ];
  tables.public_results = [
    { id: "r-sample", school: "stoicism", is_sample: true },
    { id: "r-genuine", school: "stoicism", is_sample: false },
  ];
});

describe("a challenge's link preview", () => {
  it("is the challenger's marked card for a sample challenge from a sample result", async () => {
    const m = (await generateMetadata(params("c-sample"))) as {
      openGraph?: { images?: { url: string; alt: string }[] };
      twitter?: { images?: { url: string }[] };
    };
    expect(m.openGraph?.images?.[0]).toMatchObject({ url: "/r/r-sample/opengraph-image", alt: "A sample account's result card" });
    expect(m.twitter?.images?.[0].url).toBe("/r/r-sample/opengraph-image");
  });

  it("has no image for a sample challenge whose challenger's result is not a sample", async () => {
    const m = (await generateMetadata(params("c-sample-genuine-challenger"))) as {
      title: string;
      openGraph?: { images?: unknown };
      twitter?: { images?: unknown };
    };
    expect(m.title).toBe("A sample account's challenge · Sophecs");
    expect(m.openGraph?.images).toBeUndefined();
    expect(m.twitter?.images).toBeUndefined();
  });

  it("is unchanged for a genuine challenge", async () => {
    expect(await generateMetadata(params("c-genuine"))).toEqual({ title: "You've been challenged · Sophecs" });
  });
});

describe("the result card routes, for a result they cannot read", () => {
  it("give a 404 that is not cached, not a default card", async () => {
    for (const res of [await ogImage(params("r-missing")), await cardPng(new Request("http://x/"), params("r-missing"))]) {
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("Content-Type")).not.toBe("image/png");
    }
  });
});
