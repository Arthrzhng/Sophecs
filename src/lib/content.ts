import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { SchoolId } from "./types";

// One markdown file per module in /content/modules/. The frontmatter schema
// is fixed; real modules already exist to this shape and drop in with zero
// code changes. Parsed at build time (all consumers are server components).

export interface DebateTopic {
  id: string;
  text: string;
}

export interface ModuleFrontmatter {
  id: string;
  school: string; // display name, e.g. "Stoicism"
  title: string;
  quiz_excerpt: string;
  debate_topics: DebateTopic[];
  sources: { name: string }[];
}

export interface ModuleBlock {
  // "pull" renders in the single pull-quote style the reading view offers.
  kind: "text" | "pull";
  text: string;
}

export interface ModuleSection {
  heading: string | null;
  blocks: ModuleBlock[];
}

export interface ContentModule extends ModuleFrontmatter {
  slug: string;
  school_id: SchoolId;
  sections: ModuleSection[];
}

const MODULES_DIR = path.join(process.cwd(), "content", "modules");

const SCHOOL_NAME_TO_ID: Record<string, SchoolId> = {
  Stoicism: "stoicism",
  Utilitarianism: "utilitarianism",
  "Virtue Ethics": "virtue-ethics",
};

function assertFrontmatter(
  data: Record<string, unknown>,
  file: string
): asserts data is Record<string, unknown> & ModuleFrontmatter {
  const missing = ["id", "school", "title", "quiz_excerpt", "debate_topics", "sources"].filter(
    (key) => data[key] === undefined
  );
  if (missing.length > 0) {
    throw new Error(`Module ${file} is missing frontmatter: ${missing.join(", ")}`);
  }
  if (!(data.school as string in SCHOOL_NAME_TO_ID)) {
    throw new Error(
      `Module ${file} names unknown school "${data.school}". Known: ${Object.keys(SCHOOL_NAME_TO_ID).join(", ")}`
    );
  }
  const topics = data.debate_topics as unknown;
  const malformed =
    !Array.isArray(topics) ||
    topics.some(
      (t) => typeof t !== "object" || t === null || !("id" in t) || !("text" in t)
    );
  if (malformed) {
    throw new Error(
      `Module ${file} debate_topics must be a list of {id, text} pairs`
    );
  }
}

// Bodies use "## Heading" lines as section breaks; headings render as mono
// eyebrow labels in the reading view. "> " blocks become pull quotes.
// A leading un-headed block is allowed.
function parseSections(body: string): ModuleSection[] {
  const sections: ModuleSection[] = [];
  let current: ModuleSection = { heading: null, blocks: [] };

  for (const block of body.trim().split(/\n{2,}/)) {
    const text = block.trim();
    if (text === "") continue;
    if (text.startsWith("## ")) {
      if (current.blocks.length > 0 || current.heading !== null) {
        sections.push(current);
      }
      current = { heading: text.slice(3).trim(), blocks: [] };
    } else if (text.startsWith("> ")) {
      current.blocks.push({
        kind: "pull",
        text: text
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""))
          .join(" ")
          .trim(),
      });
    } else {
      current.blocks.push({ kind: "text", text: text.replace(/\n/g, " ") });
    }
  }
  if (current.blocks.length > 0 || current.heading !== null) {
    sections.push(current);
  }
  return sections;
}

export function getAllModules(): ContentModule[] {
  const files = fs
    .readdirSync(MODULES_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(MODULES_DIR, file), "utf8");
    const { data, content } = matter(raw);
    assertFrontmatter(data, file);
    return {
      ...(data as ModuleFrontmatter),
      slug: data.id,
      school_id: SCHOOL_NAME_TO_ID[data.school],
      sections: parseSections(content),
    };
  });
}

export function getModule(slug: string): ContentModule | undefined {
  return getAllModules().find((mod) => mod.slug === slug);
}

export function getModuleBySchool(schoolId: SchoolId): ContentModule | undefined {
  return getAllModules().find((mod) => mod.school_id === schoolId);
}

// A motion's text lives only in its module's debate_topics; the data layer
// stores just the id and the scheduling window, so this is the one place
// that resolves a motion id back to what it actually says.
export function getDebateTopic(
  topicId: string
): { module: ContentModule; topic: DebateTopic } | undefined {
  for (const mod of getAllModules()) {
    const topic = mod.debate_topics.find((t) => t.id === topicId);
    if (topic) return { module: mod, topic };
  }
  return undefined;
}
