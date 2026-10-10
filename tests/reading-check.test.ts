import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import {
  readingCheckProblems,
  readingCheckScore,
  READING_CHECK_LENGTH,
  type MicroLessonContent,
} from "../src/lib/lesson-chunks";
import { isDraft } from "../src/lib/drafts";

const MICRO_DIR = path.join(process.cwd(), "content", "micro");
const lessons: MicroLessonContent[] = fs
  .readdirSync(MICRO_DIR)
  .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
  .map((f) => matter(fs.readFileSync(path.join(MICRO_DIR, f), "utf8")).data as MicroLessonContent);

describe("reading check content", () => {
  it("covers all six before-lessons", () => {
    const before = lessons.filter((l) => l.position === "before" && !isDraft(l));
    expect(before).toHaveLength(6);
    for (const lesson of before) {
      expect(lesson.reading_check, lesson.slug).toHaveLength(READING_CHECK_LENGTH);
    }
  });

  it("is valid in every lesson file", () => {
    expect(lessons.flatMap(readingCheckProblems)).toEqual([]);
  });

  // A UI that renders options in file order must not be guessable.
  it("spreads the correct answers across positions", () => {
    const answers = lessons
      .filter((l) => !isDraft(l))
      .flatMap((l) => (l.reading_check ?? []).map((q) => q.answer));
    for (const position of [0, 1, 2]) {
      expect(answers.filter((a) => a === position).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("readingCheckProblems", () => {
  const base: MicroLessonContent = {
    slug: "x-before",
    topic: "x",
    position: "before",
    title: "X",
    source: { author: "A", work: "W", section: "1" },
    body: "p",
    reading_check: [
      { question: "Q1?", options: ["a", "b", "c"], answer: 0, right: "Because a.", wrong: "It is a." },
      { question: "Q2?", options: ["a", "b", "c"], answer: 2, right: "Because c.", wrong: "It is c." },
    ],
  };

  it("accepts a well-formed check", () => {
    expect(readingCheckProblems(base)).toEqual([]);
  });

  it("rejects an out-of-range answer, a missing option and a verdict opener", () => {
    const bad = structuredClone(base);
    bad.reading_check![0].answer = 3;
    bad.reading_check![1].options = ["a", "b"];
    bad.reading_check![0].right = "Exactly. Because a.";
    const problems = readingCheckProblems(bad);
    expect(problems.some((p) => p.includes("answer must be"))).toBe(true);
    expect(problems.some((p) => p.includes("exactly 3 options"))).toBe(true);
    expect(problems.some((p) => p.includes("verdict word"))).toBe(true);
  });

  it("rejects a before-lesson without a check, and an after-lesson with one", () => {
    expect(readingCheckProblems({ ...base, reading_check: undefined })).toHaveLength(1);
    expect(readingCheckProblems({ ...base, position: "after" })).toHaveLength(1);
  });
});

describe("readingCheckScore", () => {
  it("counts right picks and treats unanswered as not right", () => {
    const check = [
      { question: "", options: [], answer: 1, right: "", wrong: "" },
      { question: "", options: [], answer: 2, right: "", wrong: "" },
    ];
    expect(readingCheckScore(check, [1, 2])).toBe(2);
    expect(readingCheckScore(check, [0, 2])).toBe(1);
    expect(readingCheckScore(check, [1])).toBe(1);
  });
});
