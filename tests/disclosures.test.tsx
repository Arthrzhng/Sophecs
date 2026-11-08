// Arthur, 2026-11-08: iOS drew the exemplar cards' disclosure triangle as
// an emoji; "Replace it everywhere with a plain drawn chevron ... no
// Unicode arrows or triangles that a phone can turn into emoji". These
// hold every disclosure in the app to that: each <summary> hides the
// browser's marker both the standard way and the WebKit way (review pass
// 1 found that dropping either went unnoticed), each <details> has a
// <summary> of its own (without one the browser draws its own, marker
// and all), each <details> that draws the Chevron is a `group` so the
// chevron and the card's text follow its state, the Chevron's two poses
// are the right way round, and no summary holds a character with an emoji
// form: not as a literal, a JavaScript or CSS escape or an entity (review
// passes 2 and 3), not in a stylesheet's or a class's `content`, and not in
// what the excerpt toggle, the open objections and the sample label
// render.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Chevron } from "../src/components/ui/Chevron";
import { BeforeLesson } from "../src/components/debate/BeforeLesson";
import { OpenObjections } from "../src/components/me/OpenObjections";
import { SampleLabel } from "../src/components/sample/SampleLabel";
import type { MicroLessonContent } from "../src/lib/lesson-chunks";
import type { OpenObjection } from "../src/lib/objections";

const walk = (dir: string, ext: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
const uncommented = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SOURCES = walk("src", ".tsx").map((p) => [p, uncommented(readFileSync(p, "utf8"))] as const);
const STYLESHEETS = walk("src", ".css").map((p) => [p, readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")] as const);
const tags = (src: string, name: string) => [...src.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);
const blocks = (src: string, name: string) => [...src.matchAll(new RegExp(`<${name}\\b[\\s\\S]*?</${name}>`, "g"))].map((m) => m[0]);

// Every character with an emoji form sits in these blocks, is
// Extended_Pictographic or Emoji_Presentation (the regional indicators and
// skin-tone modifiers), or is the keycap mark that turns a digit, "#" or
// "*" into one. Digits, "#" and "*" alone are left out, so "Show all (7)"
// passes. The blocks also hold arrows and shapes with no emoji form, which
// is stricter than needed inside a disclosure, and safe.
const EMOJI_CAPABLE = /[←-⇿⌀-⏿■-◿☀-➿⤀-⥿⬀-⯿️⃣]|\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
// The named entities a summary may use; any other could draw a symbol.
const ENTITIES = new Set(["amp", "apos", "quot", "lt", "gt", "nbsp", "middot", "ndash", "ldquo", "rdquo", "lsquo", "rsquo", "hellip"]);
const decoded = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // A CSS escape, as a stylesheet or a Tailwind class such as
    // `after:content-['\25B6']` writes one (review pass 3).
    .replace(/\\([0-9a-f]{1,6}) ?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

describe("disclosures", () => {
  it("every <summary> hides the browser's marker, the standard way and the WebKit way", () => {
    const summaries = SOURCES.flatMap(([p, s]) => tags(s, "summary").map((t) => [p, t] as const));
    expect(summaries.length).toBeGreaterThanOrEqual(7);
    for (const [p, t] of summaries) {
      expect(t, p).toContain("list-none");
      expect(t, p).toContain("[&::-webkit-details-marker]:hidden");
    }
  });

  it("every <details> opens straight on a <summary> of its own", () => {
    // Directly, not nested in a <div> or left to an inner <details>: in
    // either case the browser draws a summary of its own, marker and all.
    const all = SOURCES.flatMap(([p, s]) => blocks(s, "details").map((b) => [p, b] as const));
    expect(all.length).toBeGreaterThanOrEqual(6);
    for (const [p, s] of SOURCES) {
      const opened = [...s.matchAll(/<details\b/g)].length;
      const withSummary = [...s.matchAll(/<details\b(?:[^>]|=>)*>\s*<summary\b/g)].length;
      expect(withSummary, p).toBe(opened);
    }
  });

  it("every <details> in a file that draws a Chevron is a group", () => {
    const users = SOURCES.filter(([p, s]) => s.includes("<Chevron") && !p.endsWith("Chevron.tsx"));
    expect(users.length).toBe(3);
    // `group` itself, not `group-hover:` or `group-open:`.
    for (const [p, s] of users) for (const t of tags(s, "details")) expect(t, p).toMatch(/className=[{"`](?:[^"`]*\s)?group(?=[\s"`}])/);
  });

  it("the Chevron points right while closed and down while open, and is hidden from assistive technology", () => {
    const out = renderToStaticMarkup(createElement(Chevron));
    expect(out).toMatch(/^<svg aria-hidden="true" focusable="false"/);
    expect(out).toContain('<path d="M6 3.5 10.5 8 6 12.5" class="group-open:hidden"></path>');
    expect(out).toContain('<path d="M3.5 6 8 10.5 12.5 6" class="hidden group-open:inline"></path>');
  });

  it("no summary in the source holds a character with an emoji form, as a literal, an escape or an entity", () => {
    for (const [p, s] of SOURCES) {
      for (const block of blocks(s, "summary")) {
        expect(decoded(block), p).not.toMatch(EMOJI_CAPABLE);
        for (const [, name] of block.matchAll(/&([a-z][a-z0-9]*);/gi)) expect(ENTITIES.has(name), `${p}: &${name};`).toBe(true);
      }
    }
  });

  it("no stylesheet, and no class in the source, draws such a character as `content`", () => {
    const values = [
      ...STYLESHEETS.flatMap(([p, s]) => [...s.matchAll(/content\s*:\s*([^;}]+)/g)].map((m) => [p, m[1]] as const)),
      ...SOURCES.flatMap(([p, s]) => [...s.matchAll(/content-\[([^\]]*)\]/g)].map((m) => [p, m[1]] as const)),
    ];
    expect(STYLESHEETS.length).toBeGreaterThanOrEqual(1);
    for (const [p, v] of values) expect(decoded(v), `${p}: ${v}`).not.toMatch(EMOJI_CAPABLE);
  });

  it("what the excerpt toggle, the open objections and the sample label render holds no such character", () => {
    const lesson = { slug: "s", topic: "opaque-benefit", position: "before", title: "The cylinder and the top", body: "One.\n\nTwo.", source: { author: "A", work: "W", section: "1" } } as unknown as MicroLessonContent;
    const objections: OpenObjection[] = Array.from({ length: 7 }, (_, i) => ({
      debateId: `d${i}`,
      topicSlug: "opaque-benefit",
      topicTitle: "The opaque benefit",
      school: "stoicism",
      rivalSchool: "utilitarianism",
      claim: "A claim.",
      createdAt: "2026-11-01T00:00:00Z",
    }));
    const before = renderToStaticMarkup(createElement(BeforeLesson, { lesson }));
    const open = renderToStaticMarkup(createElement(OpenObjections, { objections, weeklyMotion: null, hasAnyDebate: true, school: "stoicism" }));
    const sample = renderToStaticMarkup(createElement(SampleLabel));
    for (const out of [before, open, sample]) {
      expect(out).toContain("<summary");
      expect(out).not.toMatch(EMOJI_CAPABLE);
    }
  });
});
