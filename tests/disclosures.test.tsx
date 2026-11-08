// Arthur, 2026-11-08: iOS drew the exemplar cards' disclosure triangle as
// an emoji; "Replace it everywhere with a plain drawn chevron ... no
// Unicode arrows or triangles that a phone can turn into emoji". These
// hold every disclosure in the app to that: each <summary> hides the
// browser's marker both the standard way and the WebKit way (review pass
// 1 found that dropping either went unnoticed), each <details> that draws
// the Chevron is a `group` so the chevron and the card's text follow its
// state, the Chevron's two poses are the right way round, and no summary
// holds a character with an emoji form.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Chevron } from "../src/components/ui/Chevron";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
const uncommented = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SOURCES = walk("src").map((p) => [p, uncommented(readFileSync(p, "utf8"))] as const);
const tags = (src: string, name: string) => [...src.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);

describe("disclosures", () => {
  it("every <summary> hides the browser's marker, the standard way and the WebKit way", () => {
    const summaries = SOURCES.flatMap(([p, s]) => tags(s, "summary").map((t) => [p, t] as const));
    expect(summaries.length).toBeGreaterThanOrEqual(7);
    for (const [p, t] of summaries) {
      expect(t, p).toContain("list-none");
      expect(t, p).toContain("[&::-webkit-details-marker]:hidden");
    }
  });
  it("every <details> in a file that draws a Chevron is a group", () => {
    const users = SOURCES.filter(([p, s]) => s.includes("<Chevron") && !p.endsWith("Chevron.tsx"));
    expect(users.length).toBe(3);
    for (const [p, s] of users) for (const t of tags(s, "details")) expect(t, p).toMatch(/className=[{"`][^"`]*\bgroup\b/);
  });
  it("the Chevron points right while closed and down while open, and is hidden from assistive technology", () => {
    const out = renderToStaticMarkup(createElement(Chevron));
    expect(out).toMatch(/^<svg aria-hidden="true" focusable="false"/);
    expect(out).toContain('<path d="M6 3.5 10.5 8 6 12.5" class="group-open:hidden"></path>');
    expect(out).toContain('<path d="M3.5 6 8 10.5 12.5 6" class="hidden group-open:inline"></path>');
  });
  it("no source draws a disclosure character a phone can turn into an emoji", () => {
    const glyph = /[←-⇿⌀-⏿■-◿✀-➿⤀-⥿⬀-⯿️]|\p{Extended_Pictographic}|&(?:#9654|#x25b6|#9656|#x25b8|rtrif|blacktriangleright);/iu;
    for (const [p, s] of SOURCES) {
      const code = s;
      for (const t of [...tags(code, "summary")]) expect(t, p).not.toMatch(glyph);
      const inSummaries = [...code.matchAll(/<summary\b[\s\S]*?<\/summary>/g)].map((m) => m[0]);
      for (const block of inSummaries) expect(block, p).not.toMatch(glyph);
    }
  });
});
