// The exemplars page (src/app/debate/[slug]/exemplars/page.tsx): not found
// without a read for a slug no motion could have, not found for an
// inactive motion or one with nothing to show, thrown (so a built page
// keeps serving) when the motion cannot be read, and never a sample
// debate's id in what it renders.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exemplar } from "../src/lib/exemplars";
import type { SchoolId } from "../src/lib/types";

let topic: { data: unknown; error: unknown } = { data: null, error: null };
let reads = 0;
const filters: [string, unknown][] = [];
vi.mock("@/lib/supabase/admin", () => ({
  isAdminConfigured: () => true,
  createAdminClient: () => ({
    from: () => {
      reads++;
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => (filters.push([c, v]), b),
        maybeSingle: async () => topic,
      };
      return b;
    },
  }),
}));

let exemplars = new Map<SchoolId, Exemplar[]>();
const asked: unknown[][] = [];
vi.mock("@/lib/exemplars", () => ({
  getExemplars: async (...args: unknown[]) => (asked.push(args.slice(1, 3)), exemplars),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: ExemplarsPage, metadata } = await import("../src/app/debate/[slug]/exemplars/page");
const render = async (slug: string) =>
  renderToStaticMarkup(await ExemplarsPage({ params: Promise.resolve({ slug }) })).replace(/&#x27;/g, "'");

const MOTION = { slug: "opaque-benefit", motion: "This house would deploy it.", active: true };

beforeEach(() => {
  topic = { data: MOTION, error: null };
  reads = 0;
  filters.length = 0;
  asked.length = 0;
  exemplars = new Map([
    ["stoicism", [{ id: "11111111-2222-3333-4444-555555555555", school: "stoicism", argument: "Here is my answer. Deploy it. Because.\n\nMore.", opening: "Deploy it.", preview: "Deploy it. Because." }]],
  ]);
});

describe("the exemplars page", () => {
  it("shows the heading, the line under it, the motion and each card's first two sentences, and no id", async () => {
    const out = await render("opaque-benefit");
    expect(out).toContain("Exemplar ways to argue this motion</h1>");
    expect(out).toContain("Written as examples for Sophecs.");
    expect(out).toContain(MOTION.motion);
    // Closed, the card shows its preview and a drawn chevron; never the
    // browser's marker or a character a phone can turn into an emoji.
    expect(out).toMatch(/<summary[^>]*list-none[^>]*><span[^>]*group-open:hidden[^>]*>Deploy it\. Because\.<\/span><span[^>]*>Hide<\/span><svg aria-hidden="true"/);
    expect(out).not.toMatch(/[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2700-\u27BF\u2900-\u297F\u2B00-\u2BFF\uFE0F]|\p{Extended_Pictographic}/u);
    expect(out).toContain("<p>Here is my answer. Deploy it. Because.</p><p>More.</p>");
    expect(out).not.toContain("11111111-2222");
    // A sample page to analytics: nothing of it reaches PostHog.
    expect(out).toContain('data-sophecs-sample-page=""');
    expect(filters).toEqual([["slug", "opaque-benefit"]]);
    expect(asked).toEqual([["opaque-benefit", MOTION.motion]]);
  });

  it("previews as itself, with the site's image", () => {
    expect(metadata.openGraph.title).toBe("Exemplar ways to argue this motion · Sophecs");
    expect(metadata.openGraph.images).toEqual([expect.objectContaining({ url: "/opengraph-image", width: 1200, height: 630 })]);
    expect(metadata.twitter.images).toEqual(metadata.openGraph.images);
  });

  it("is not found, without a read, for a slug no motion could have", async () => {
    for (const slug of ["Opaque-Benefit", "a b", "-x", "x".repeat(65), "x/y"]) {
      await expect(render(slug), slug).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(reads).toBe(0);
  });

  it("is not found for no motion, an inactive one, or one with nothing to show", async () => {
    topic = { data: null, error: null };
    await expect(render("no-decision")).rejects.toThrow("NEXT_NOT_FOUND");
    // The motion it looked up is the one in the address.
    expect(filters).toEqual([["slug", "no-decision"]]);
    topic = { data: { ...MOTION, active: false }, error: null };
    await expect(render("opaque-benefit")).rejects.toThrow("NEXT_NOT_FOUND");
    topic = { data: MOTION, error: null };
    exemplars = new Map([["stoicism", []]]);
    await expect(render("opaque-benefit")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws, rather than reading as not found, when the motion cannot be read", async () => {
    topic = { data: null, error: { message: "timeout" } };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(render("opaque-benefit")).rejects.toThrow("could not be read");
    quiet.mockRestore();
  });
});
