import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SCHOOL_IDS } from "./footnotes";
import type { Source } from "./footnotes";
import type { SchoolId } from "./types";

export interface ModuleContent {
  id: string;
  school: SchoolId;
  title: string;
  quiz_excerpt: string;
  debate_topics: string[];
  sources: Source[];
  body: string;
}

const MODULES_DIR = path.join(process.cwd(), "content", "modules");

// Required fields, in the order the README documents them. `body` is
// deliberately absent: a module can sit here half-written without breaking
// the build, and is skipped until it has one.
const REQUIRED = ["id", "school", "title", "quiz_excerpt", "debate_topics", "sources"] as const;

/**
 * Reads content/modules/*.md.
 *
 * Returns an empty list when the directory holds nothing but its README,
 * which is the state it ships in — the lessons index is complete without
 * modules and grows a section when the first one lands.
 *
 * A file missing a required field is skipped with a warning naming the file
 * and the field, rather than throwing. A half-written module should not be
 * able to fail a deploy of the rest of the site; a malformed *micro-lesson*
 * does throw, because those are load-bearing for the debate flow and an
 * empty one would silently swallow a reader's argument prompt.
 */
export function getAllModules(): ModuleContent[] {
  if (!fs.existsSync(MODULES_DIR)) return [];

  const modules: ModuleContent[] = [];
  for (const file of fs.readdirSync(MODULES_DIR).sort()) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const where = `content/modules/${file}`;
    const { data } = matter(fs.readFileSync(path.join(MODULES_DIR, file), "utf8"));

    const missing = REQUIRED.filter((key) => data[key] == null || data[key] === "");
    if (missing.length > 0) {
      console.warn(`${where}: skipped, missing ${missing.join(", ")}`);
      continue;
    }
    if (typeof data.body !== "string" || data.body.trim() === "") {
      console.warn(`${where}: skipped, no body yet`);
      continue;
    }
    if (!SCHOOL_IDS.includes(data.school as SchoolId)) {
      console.warn(`${where}: skipped, school "${data.school}" is not one of ${SCHOOL_IDS.join(", ")}`);
      continue;
    }
    if (!Array.isArray(data.debate_topics) || !Array.isArray(data.sources)) {
      console.warn(`${where}: skipped, debate_topics and sources must both be lists`);
      continue;
    }

    modules.push({
      id: String(data.id),
      school: data.school as SchoolId,
      title: String(data.title),
      quiz_excerpt: String(data.quiz_excerpt),
      debate_topics: data.debate_topics.map(String),
      sources: data.sources as Source[],
      body: data.body,
    });
  }
  return modules;
}

export function getModule(id: string): ModuleContent | null {
  return getAllModules().find((m) => m.id === id) ?? null;
}
