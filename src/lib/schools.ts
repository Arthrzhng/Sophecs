import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { pickShareLineFrom } from "./share-line";
import { excluded, type LoadOptions } from "./drafts";
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
  verdict_share_line: string;
  /** See lib/drafts.ts. Draft files load only on /styleguide/drafts. */
  status?: "draft";
}

const SCHOOLS_DIR = path.join(process.cwd(), "content", "schools");

// Everything on disk, drafts included. The filter happens per call rather
// than per cache, so one read of the directory serves both callers.
let cache: SchoolContent[] | null = null;

function loadAll(): SchoolContent[] {
  if (cache) return cache;
  cache = fs
    .readdirSync(SCHOOLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(SCHOOLS_DIR, file), "utf8");
      return matter(raw).data as SchoolContent;
    });
  return cache;
}

export function getAllSchools(options: LoadOptions = {}): Record<SchoolId, SchoolContent> {
  const result = {} as Record<SchoolId, SchoolContent>;
  for (const school of loadAll()) {
    if (excluded(school, options)) continue;
    result[school.id] = school;
  }
  return result;
}

// Deliberately has no `includeDrafts`. Every caller looks a school up by a
// `SchoolId`, which no draft can be until the union is widened, so an
// opt-in here would be unreachable. The review route reads drafts through
// getAllSchools instead.
export function getSchool(id: SchoolId): SchoolContent {
  const school = getAllSchools()[id];
  if (!school) throw new Error(`No content for school "${id}"`);
  return school;
}

// Deterministic rotation: same result id always shows the same share line,
// so it's trackable and A/B-able in Phase 4. The choosing itself lives in
// the pure `share-line` module, which /quiz/result imports on the client.
export function pickShareLine(id: SchoolId, resultId: string): { text: string; index: number } {
  return pickShareLineFrom(getSchool(id).share_lines, resultId);
}
