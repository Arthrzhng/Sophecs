// The six motions, from content/topics: the plan is built offline from the
// files, and the run refuses to start unless the target's debate_topics
// rows say the same thing (engine.ts, preflight).
import { getAllTopicFiles } from "../../src/lib/topics";
import { TOPICS } from "./banks";
import type { GenConfig } from "./generate";

export function contentTopics(): GenConfig["topics"] {
  const files = getAllTopicFiles().filter((t) => t.active);
  const out = files.map((t) => ({
    slug: t.slug,
    title: t.title,
    motion: t.motion,
    sort: t.sort,
    microBefore: t.micro_before,
  }));
  for (const slug of TOPICS)
    if (!out.some((t) => t.slug === slug)) throw new Error(`content/topics has no active ${slug}`);
  return out.sort((a, b) => a.sort - b.sort);
}
