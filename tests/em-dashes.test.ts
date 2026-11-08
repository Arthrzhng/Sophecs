// Arthur, 2026-11-08: "em dashes in UI copy (house rule: none)". The site
// pass (docs/decisions.md, "A pass over the whole site for what reads as
// machine-written") took every one out of the pages; this holds every .tsx
// file in src to that, comments aside. The first review of that pass found
// three written as — escapes, which a search for the character alone
// missed, so escapes and entities are resolved first.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
const uncommented = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const decoded = (s: string) =>
  s
    .replace(/&mdash;/g, "—")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

describe("em dashes", () => {
  it("appear in no .tsx file in src outside its comments, as a character, an escape or an entity", () => {
    const files = walk("src");
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((p) =>
      decoded(uncommented(readFileSync(p, "utf8")))
        .split("\n")
        .flatMap((line, i) => (line.includes("—") ? [`${p}:${i + 1}: ${line.trim()}`] : []))
    );
    expect(found).toEqual([]);
  });
});
