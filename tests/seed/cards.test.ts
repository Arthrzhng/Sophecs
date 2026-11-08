// The share and link-preview images carry the "AI sample" mark for a sample account's
// verdict or result (Arthur, 2026-11-04: on every surface a sample
// appears), and nothing extra for a reader's.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { VerdictCard } from "../../src/components/debate/VerdictCard";
import { CardLayout } from "../../src/components/card/CardLayout";

const fonts = { serif: "Spectral", sans: "IBM Plex Sans", mono: "IBM Plex Mono" };

describe("share images", () => {
  it("mark a sample verdict, and only a sample one", () => {
    const html = (sample: boolean) => renderToStaticMarkup(createElement(VerdictCard, { school: "stoicism", motion: "A motion.", score: 61, width: 1200, height: 630, fonts, sample }));
    expect(html(true)).toContain(">AI sample<");
    expect(html(false)).not.toMatch(/sample/i);
  });
  it("mark a sample result card, landscape and portrait, and only a sample one", () => {
    for (const [width, height] of [[1200, 630], [1080, 1350]]) {
      const html = (sample: boolean) => renderToStaticMarkup(createElement(CardLayout, { school: "stoicism", oneLine: "A line.", oneLineAttribution: "Someone", width, height, fonts, sample }));
      expect(html(true)).toContain(">AI sample<");
      expect(html(false)).not.toMatch(/sample/i);
    }
  });
  it("are asked for the marker by every image route", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/app/debate/[slug]/[debateId]/opengraph-image.tsx", "src/app/r/[id]/opengraph-image.tsx", "src/app/r/[id]/card.png/route.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/is_sample/);
      expect(src, f).toMatch(/sample=\{sample\}/);
    }
  });
});

describe("link previews of sample pages", () => {
  it("have the plain title a genuine page of the kind has, in the tab and the previews, and no referrer", async () => {
    const { sampleMetadata } = await import("../../src/lib/sample");
    const m = sampleMetadata("Verdict · Sophecs");
    expect(m.openGraph.title).toBe("Verdict · Sophecs");
    expect(m.twitter.title).toBe("Verdict · Sophecs");
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/app/debate/[slug]/[debateId]/page.tsx", "utf8")).toContain('sampleMetadata("Verdict · Sophecs")');
    expect(readFileSync("src/app/c/[id]/page.tsx", "utf8")).toMatch(/sampleMetadata\(\s*"A challenge · Sophecs"/);
    expect(readFileSync("src/app/r/[id]/page.tsx", "utf8")).toMatch(/twitter: \{ card: "summary_large_image", title \}/);
  });

  it("give a sample challenge a preview image that carries the mark", async () => {
    const { sampleMetadata } = await import("../../src/lib/sample");
    const m = sampleMetadata("A challenge · Sophecs", { url: "/r/R1/opengraph-image", alt: "A result card, marked as an AI sample" });
    expect(m.openGraph.images?.[0]).toMatchObject({ url: "/r/R1/opengraph-image", alt: "A result card, marked as an AI sample", width: 1200, height: 630 });
    expect(m.twitter.images?.[0].url).toBe("/r/R1/opengraph-image");
    // Without one, no images key at all: Next.js skips a segment's own
    // opengraph-image whenever the key is present, even as undefined, which
    // would take the sample verdict page's marked card away.
    expect(sampleMetadata("x").openGraph).not.toHaveProperty("images");
    expect(sampleMetadata("x").twitter).not.toHaveProperty("images");
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/c/[id]/page.tsx", "utf8");
    // The challenger's result card, only when that result is a sample
    // (tests/seed/challenge-preview.test.ts calls generateMetadata)...
    expect(page).toMatch(/challengerIsSample: Boolean\(result\.is_sample\)/);
    // ...whose image draws the mark from the result's own marker.
    const og = readFileSync("src/app/r/[id]/opengraph-image.tsx", "utf8");
    expect(og).toMatch(/\.select\("school, is_sample, quiz_version"\)/);
    expect(og).toMatch(/sample=\{sample\}/);
  });
});
