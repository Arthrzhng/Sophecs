import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface MicroLessonContent {
  slug: string;
  topic: string;
  position: "before" | "after";
  title: string;
  source: { author: string; work: string; section: string };
  body: string; // 150-250 words, frontmatter field — same convention as content/schools' `read`
}

const MICRO_DIR = path.join(process.cwd(), "content", "micro");

let cache: Record<string, MicroLessonContent> | null = null;

function loadAll(): Record<string, MicroLessonContent> {
  if (cache) return cache;
  const result: Record<string, MicroLessonContent> = {};
  if (fs.existsSync(MICRO_DIR)) {
    for (const file of fs
      .readdirSync(MICRO_DIR)
      .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")) {
      const raw = fs.readFileSync(path.join(MICRO_DIR, file), "utf8");
      const { data } = matter(raw);
      result[data.slug as string] = data as MicroLessonContent;
    }
  }
  cache = result;
  return result;
}

export function getMicroLesson(slug: string): MicroLessonContent | null {
  return loadAll()[slug] ?? null;
}
