import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import { moduleReadingProblems, splitModule } from "../src/lib/module-readings";
import { isDraft } from "../src/lib/drafts";

const DIR = path.join(process.cwd(), "content", "modules");
const modules = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .map((f) => ({ file: f, data: matter(fs.readFileSync(path.join(DIR, f), "utf8")).data }));

// The three assertions below are about what the product ships, so they
// are scoped to published modules. A draft is not on Today's lessons
// card and is not required to be finished; what it is required to do is
// mark its readings validly, which the loader throws on and which the
// last test in this block covers for drafts too.
const published = modules.filter(({ data }) => !isDraft(data));

describe("module readings content", () => {
  // Today's lessons card says "All three modules read." in words
  // (docs/daily-path-copy.md §5). A fourth module would make that line
  // false, and this is where it is caught.
  it("is three published modules, one for each school", () => {
    expect(published).toHaveLength(3);
    expect(new Set(published.map((m) => m.data.school)).size).toBe(3);
  });

  it("every published module marks valid readings", () => {
    for (const { file, data } of published) {
      expect(data.readings, file).toBeDefined();
      expect(moduleReadingProblems(file, data.body, data.readings)).toEqual([]);
    }
  });

  // Including drafts: bad reading marks throw at module load, which fails
  // the build, and a draft is loaded on the review route.
  it("every module on disk marks valid readings, draft or not", () => {
    for (const { file, data } of modules) {
      expect(moduleReadingProblems(file, data.body, data.readings), file).toEqual([]);
    }
  });

  it("splitting loses and repeats no paragraph", () => {
    for (const { data } of published) {
      const parts = splitModule(data.title, data.body, data.readings);
      expect(parts.flatMap((p) => p.paragraphs)).toEqual(data.body.split("\n\n"));
      expect(parts.every((p) => p.paragraphs.length > 0)).toBe(true);
    }
  });
});

describe("moduleReadingProblems", () => {
  const body = "a\n\nb\n\nc";
  it("rejects a first reading not at 0, a repeat, and out of range", () => {
    expect(moduleReadingProblems("x", body, [{ title: "T", from_paragraph: 1 }])).toHaveLength(1);
    expect(
      moduleReadingProblems("x", body, [
        { title: "T", from_paragraph: 0 },
        { title: "U", from_paragraph: 0 },
      ])
    ).toHaveLength(1);
    expect(
      moduleReadingProblems("x", body, [
        { title: "T", from_paragraph: 0 },
        { title: "U", from_paragraph: 3 },
      ])
    ).toHaveLength(1);
  });

  it("treats a module with no readings as one reading", () => {
    expect(moduleReadingProblems("x", body, undefined)).toEqual([]);
    expect(splitModule("M", body)).toEqual([{ title: "M", paragraphs: ["a", "b", "c"] }]);
  });
});
