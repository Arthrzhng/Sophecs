import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { MAX_RETRIEVAL_PROMPTS, type MicroLessonContent } from "./lesson-chunks";

// The shape and the chunking rule live in `lesson-chunks`, which the client
// components import directly; this module adds the filesystem loading and
// the validation that has to fail the build.
export {
  chunkLesson,
  MAX_RETRIEVAL_PROMPTS,
  MAX_RETRIEVAL_RESPONSE_CHARS,
} from "./lesson-chunks";
export type { MicroLessonContent, RetrievalPrompt, LessonChunk } from "./lesson-chunks";

// Thrown at module load, which in practice means during `next build` (every
// route that renders a lesson imports this). A prompt pointing at a
// paragraph that doesn't exist would otherwise silently swallow the rest of
// the lesson at request time.
function validate(lesson: MicroLessonContent): void {
  const prompts = lesson.retrieval_prompts;
  if (!prompts) return;

  const where = `content/micro/${lesson.slug}.md`;
  if (!Array.isArray(prompts)) {
    throw new Error(`${where}: retrieval_prompts must be a list`);
  }
  if (prompts.length > MAX_RETRIEVAL_PROMPTS) {
    throw new Error(
      `${where}: ${prompts.length} retrieval_prompts, maximum is ${MAX_RETRIEVAL_PROMPTS}`
    );
  }
  const paragraphCount = lesson.body.split("\n\n").length;
  const seen = new Set<number>();
  for (const { after_paragraph: index, prompt } of prompts) {
    if (!Number.isInteger(index) || index < 0 || index >= paragraphCount) {
      throw new Error(
        `${where}: after_paragraph ${index} is out of range (lesson has ${paragraphCount} paragraphs, so 0-${paragraphCount - 1})`
      );
    }
    // The last paragraph of a "before" lesson states the motion, and a
    // prompt after it would sit between the motion and the Begin button.
    if (index === paragraphCount - 1) {
      throw new Error(
        `${where}: after_paragraph ${index} is the last paragraph — a prompt there would follow the motion rather than the reading`
      );
    }
    if (seen.has(index)) {
      throw new Error(`${where}: two retrieval_prompts both follow paragraph ${index}`);
    }
    seen.add(index);
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error(`${where}: retrieval prompt after paragraph ${index} is empty`);
    }
  }
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
      const lesson = data as MicroLessonContent;
      validate(lesson);
      result[lesson.slug] = lesson;
    }
  }
  cache = result;
  return result;
}

export function getMicroLesson(slug: string): MicroLessonContent | null {
  return loadAll()[slug] ?? null;
}

// Backs /lessons, so a reader can find an excerpt again after meeting it
// once inside a debate. Grouped by topic, "before" ahead of "after", which
// is the order they're encountered in.
export function getAllMicroLessons(): MicroLessonContent[] {
  return Object.values(loadAll()).sort(
    (a, b) =>
      a.topic.localeCompare(b.topic) ||
      (a.position === b.position ? 0 : a.position === "before" ? -1 : 1)
  );
}
