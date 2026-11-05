// A sample challenge's link preview (src/app/c/[id]/page.tsx) is the
// challenger's result card, which draws the Sample mark, and only when
// that result is itself a sample. The card routes draw the mark from the
// row's own marker, and give no image at all, uncached, for a row they
// cannot read, rather than a default card that would carry no mark.
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

// The reads these routes make: .from(t).select(cols).eq(col, v), then
// .single() or .maybeSingle(). Only the selected columns come back, as
// from PostgREST, so a marker a route forgets to select reads as missing.
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

// What each card would draw, without depending on Satori's pixels.
const drawn: { card: string; sample: unknown }[] = [];
const stub = (card: string) =>
  function StubCard(props: { sample?: boolean }) {
    drawn.push({ card, sample: props.sample });
    return createElement("div", { style: { display: "flex" } }, card);
  };
vi.mock("@/components/card/CardLayout", () => ({ CardLayout: stub("result") }));
vi.mock("@/components/debate/VerdictCard", () => ({ VerdictCard: stub("verdict") }));

const { generateMetadata } = await import("../../src/app/c/[id]/page");
const resultOg = (await import("../../src/app/r/[id]/opengraph-image")).default;
const { GET: resultPng } = await import("../../src/app/r/[id]/card.png/route");
const verdictOg = (await import("../../src/app/debate/[slug]/[debateId]/opengraph-image")).default;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const verdictParams = (debateId: string) => ({ params: Promise.resolve({ slug: "t", debateId }) });

beforeEach(() => {
  drawn.length = 0;
  tables.challenges = [
    { id: "c-sample", challenger_result_id: "r-sample", is_sample: true },
    { id: "c-sample-genuine-challenger", challenger_result_id: "r-genuine", is_sample: true },
    { id: "c-genuine", challenger_result_id: "r-genuine", is_sample: false },
  ];
  tables.public_results = [
    { id: "r-sample", school: "stoicism", is_sample: true, quiz_version: 1 },
    { id: "r-genuine", school: "stoicism", is_sample: false, quiz_version: 1 },
  ];
  tables.debates_public = [
    { id: "d-sample", school: "stoicism", score: 61, topic_slug: "t", motion_text: "A motion.", is_sample: true },
    { id: "d-genuine", school: "stoicism", score: 61, topic_slug: "t", motion_text: "A motion.", is_sample: false },
  ];
  tables.debate_topics = [{ slug: "t", motion: "A motion." }];
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
    const m = (await generateMetadata(params("c-sample-genuine-challenger"))) as { title: string; openGraph?: object; twitter?: object };
    expect(m.title).toBe("A sample account's challenge · Sophecs");
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.twitter).not.toHaveProperty("images");
  });

  it("is unchanged for a genuine challenge", async () => {
    expect(await generateMetadata(params("c-genuine"))).toEqual({ title: "You've been challenged · Sophecs" });
  });
});

describe("the card routes", () => {
  const routes = [
    { name: "result preview", card: "result", run: (id: string) => resultOg(params(`r-${id}`)) },
    { name: "result download", card: "result", run: (id: string) => resultPng(new Request("http://x/"), params(`r-${id}`)) },
    { name: "verdict preview", card: "verdict", run: (id: string) => verdictOg(verdictParams(`d-${id}`)) },
  ];

  for (const r of routes) {
    it(`${r.name}: marks a sample's card and not a genuine one, cached as before`, async () => {
      for (const [id, sample] of [["sample", true], ["genuine", false]] as const) {
        drawn.length = 0;
        const res = await r.run(id);
        await res.arrayBuffer();
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/png");
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
        expect(drawn).toEqual([{ card: r.card, sample }]);
      }
    });

    it(`${r.name}: a row it cannot read is a 404 that is not cached, and nothing is drawn`, async () => {
      const res = await r.run("missing");
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(drawn).toEqual([]);
    });
  }

  it("verdict preview: a debate whose topic row is missing still draws its marked card, with the default motion", async () => {
    tables.debate_topics = [];
    const res = await verdictOg(verdictParams("d-sample"));
    await res.arrayBuffer();
    expect(res.status).toBe(200);
    expect(drawn).toEqual([{ card: "verdict", sample: true }]);
  });
});
