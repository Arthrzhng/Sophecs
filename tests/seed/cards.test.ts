// The share and link-preview images say "Sample" for a sample account's
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
    expect(html(true)).toContain("Sample assessment");
    expect(html(false)).not.toMatch(/Sample/);
  });
  it("mark a sample result card, landscape and portrait, and only a sample one", () => {
    for (const [width, height] of [[1200, 630], [1080, 1350]]) {
      const html = (sample: boolean) => renderToStaticMarkup(createElement(CardLayout, { school: "stoicism", oneLine: "A line.", oneLineAttribution: "Someone", width, height, fonts, sample }));
      expect(html(true)).toContain(">Sample<");
      expect(html(false)).not.toMatch(/Sample/);
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
