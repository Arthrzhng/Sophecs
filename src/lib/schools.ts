import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { SchoolId } from "./types";

export interface SchoolContent {
  id: SchoolId;
  name: string;
  colour_token: string;
  one_line: string;
  one_line_attribution: string;
  read: string;
  gets_wrong: string;
  share_lines: string[];
}

const SCHOOLS_DIR = path.join(process.cwd(), "content", "schools");

let cache: Record<SchoolId, SchoolContent> | null = null;

export function getAllSchools(): Record<SchoolId, SchoolContent> {
  if (cache) return cache;
  const files = fs.readdirSync(SCHOOLS_DIR).filter((f) => f.endsWith(".md"));
  const result = {} as Record<SchoolId, SchoolContent>;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(SCHOOLS_DIR, file), "utf8");
    const { data } = matter(raw);
    result[data.id as SchoolId] = data as SchoolContent;
  }
  cache = result;
  return result;
}

export function getSchool(id: SchoolId): SchoolContent {
  const school = getAllSchools()[id];
  if (!school) throw new Error(`No content for school "${id}"`);
  return school;
}

// Deterministic rotation: same result id always shows the same share line,
// so it's trackable and A/B-able in Phase 4.
export function pickShareLine(id: SchoolId, resultId: string): { text: string; index: number } {
  const lines = getSchool(id).share_lines;
  let hash = 0;
  for (let i = 0; i < resultId.length; i++) {
    hash = (hash * 31 + resultId.charCodeAt(i)) >>> 0;
  }
  const index = hash % lines.length;
  return { text: lines[index], index };
}
