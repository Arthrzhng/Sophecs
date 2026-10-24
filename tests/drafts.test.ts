import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import { excluded, isDraft } from "../src/lib/drafts";
import { POSITION_ORDER, readingCheckProblems, type MicroLessonContent } from "../src/lib/lesson-chunks";

describe("isDraft", () => {
  it("is the exact string and nothing else", () => {
    expect(isDraft({ status: "draft" })).toBe(true);
    expect(isDraft({})).toBe(false);
    expect(isDraft({ status: undefined })).toBe(false);
  });

  // The default has to be "published", so that a typo in the status field
  // makes a draft visible on a preview rather than making a finished file
  // vanish from production with nothing to show for it.
  it("treats a mistyped status as published", () => {
    expect(isDraft({ status: "Draft" })).toBe(false);
    expect(isDraft({ status: "drafts" })).toBe(false);
    expect(isDraft({ status: true })).toBe(false);
    expect(isDraft({ status: 1 })).toBe(false);
  });
});

describe("excluded", () => {
  const draft = { status: "draft" };
  const published = { status: "published" };

  it("hides a draft unless the caller opts in", () => {
    expect(excluded(draft)).toBe(true);
    expect(excluded(draft, {})).toBe(true);
    expect(excluded(draft, { includeDrafts: false })).toBe(true);
    expect(excluded(draft, { includeDrafts: true })).toBe(false);
  });

  it("never hides a published file, whichever way it is called", () => {
    expect(excluded(published)).toBe(false);
    expect(excluded(published, { includeDrafts: true })).toBe(false);
    expect(excluded({})).toBe(false);
  });
});

describe("POSITION_ORDER", () => {
  it("leaves before ahead of after, and puts elsewhere last", () => {
    expect(POSITION_ORDER.before).toBeLessThan(POSITION_ORDER.after);
    expect(POSITION_ORDER.after).toBeLessThan(POSITION_ORDER.elsewhere);
  });
});

describe('the "elsewhere" position', () => {
  const base: MicroLessonContent = {
    slug: "x-elsewhere",
    topic: "x",
    position: "elsewhere",
    status: "draft",
    title: "X",
    source: { author: "A", work: "W", section: "1" },
    body: "p",
  };

  it("needs no reading check, where a before-lesson does", () => {
    expect(readingCheckProblems(base)).toEqual([]);
    expect(readingCheckProblems({ ...base, position: "before" })).toHaveLength(1);
  });

  it("is rejected if it carries one anyway", () => {
    const withCheck: MicroLessonContent = {
      ...base,
      reading_check: [
        { question: "Q?", options: ["a", "b", "c"], answer: 0, right: "Because a.", wrong: "It is a." },
      ],
    };
    expect(readingCheckProblems(withCheck)).toHaveLength(1);
  });
});

// Vacuous until the first "elsewhere" passage lands, and the point of
// writing it now: whichever phase adds one fails here if it publishes it.
describe("content on disk", () => {
  const MICRO_DIR = path.join(process.cwd(), "content", "micro");
  const lessons: MicroLessonContent[] = fs
    .readdirSync(MICRO_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => matter(fs.readFileSync(path.join(MICRO_DIR, f), "utf8")).data as MicroLessonContent);

  it("keeps every elsewhere passage a draft, and every draft out of the pair", () => {
    for (const lesson of lessons) {
      if (lesson.position === "elsewhere") {
        expect(isDraft(lesson), `${lesson.slug} is an elsewhere passage and must be a draft`).toBe(
          true
        );
      }
      if (isDraft(lesson)) {
        expect(lesson.position, `${lesson.slug} is a draft`).toBe("elsewhere");
      }
    }
  });

  it("still ships six published before-lessons and six after", () => {
    const published = lessons.filter((l) => !isDraft(l));
    expect(published.filter((l) => l.position === "before")).toHaveLength(6);
    expect(published.filter((l) => l.position === "after")).toHaveLength(6);
  });
});

// Added after a reviewer pointed out that dropping `.claude/**` from any
// of the three tool configs would break nothing in the suite, against the
// charter's own rule that a guard is proved by breaking it. The configs
// exist because reviewer agents work in git worktrees under
// .claude/worktrees/, each a full copy of this repository on its own
// branch, and all three tools globbed into them.
describe("the reviewer worktrees stay out of the toolchain", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf-8");

  it("vitest excludes them, and keeps its own defaults", () => {
    const config = read("vitest.config.mts");
    expect(config).toContain('".claude/**"');
    // Spread, not replaced: dropping configDefaults would start running
    // node_modules' own tests instead.
    expect(config).toContain("...configDefaults.exclude");
  });

  it("tsc excludes them", () => {
    expect(JSON.parse(read("tsconfig.json")).exclude).toContain(".claude");
  });

  it("eslint ignores them", () => {
    expect(read("eslint.config.mjs")).toContain('".claude/**"');
  });

  it("git ignores them", () => {
    expect(read(".gitignore")).toContain(".claude/worktrees/");
  });
});
