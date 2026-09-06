import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { SchoolId } from "./types";

export interface TopicFile {
  slug: string;
  title: string;
  motion: string;
  stances: Record<SchoolId, string>;
  micro_before: string;
  micro_after: string;
  sort: number;
  active: boolean;
}

const TOPICS_DIR = path.join(process.cwd(), "content", "topics");

// Used only by scripts/seed-topics.ts — the running app reads debate_topics
// from the database, not markdown directly, so content edits don't need a
// deploy. Tolerates a missing/empty directory since Arthur hasn't written
// the six topics yet; see docs/decisions.md.
export function getAllTopicFiles(): TopicFile[] {
  if (!fs.existsSync(TOPICS_DIR)) return [];
  return fs
    .readdirSync(TOPICS_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((file) => {
      const raw = fs.readFileSync(path.join(TOPICS_DIR, file), "utf8");
      const { data } = matter(raw);
      return data as TopicFile;
    });
}
