import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import { moduleReadingProblems, splitModule } from "../src/lib/module-readings";

const DIR = path.join(process.cwd(), "content", "modules");
const modules = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .map((f) => ({ file: f, data: matter(fs.readFileSync(path.join(DIR, f), "utf8")).data }));

describe("module readings content", () => {
  it("every module marks valid readings", () => {
    for (const { file, data } of modules) {
      expect(data.readings, file).toBeDefined();
      expect(moduleReadingProblems(file, data.body, data.readings)).toEqual([]);
    }
  });

  it("splitting loses and repeats no paragraph", () => {
    for (const { data } of modules) {
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
