import type { MetadataRoute } from "next";
import { getAllTopicFiles } from "@/lib/topics";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { PUBLISHED_SCHOOL_IDS } from "@/lib/school-registry";

const BASE = "https://sophecs.com";

// /r/[id] result pages are deliberately absent: they are shared by link, not
// found by search, and indexing every card would bury the pages that should
// carry the SEO weight. Read from the content files rather than the database
// so generating the sitemap never depends on Supabase being reachable.
export default function sitemap(): MetadataRoute.Sitemap {
  const topics = getAllTopicFiles()
    .filter((topic) => topic.active)
    .sort((a, b) => a.sort - b.sort)
    .map((topic) => ({ url: `${BASE}/debate/${topic.slug}`, priority: 0.7 }));

  const lessons = getAllMicroLessons().map((lesson) => ({
    url: `${BASE}/lessons/${lesson.slug}`,
    priority: 0.5,
  }));

  return [
    { url: BASE, priority: 1 },
    { url: `${BASE}/quiz`, priority: 0.9 },
    // Every published school, in registry order, which is the order
    // /s/[school] generates its static params in.
    ...PUBLISHED_SCHOOL_IDS.map((school) => ({
      url: `${BASE}/s/${school}`,
      priority: 0.8,
    })),
    { url: `${BASE}/debate`, priority: 0.7 },
    ...topics,
    { url: `${BASE}/lessons`, priority: 0.5 },
    ...lessons,
    // Both were public and unlisted. A product that scores a teenager's
    // reasoning should have the pages explaining the scoring findable.
    { url: `${BASE}/method`, priority: 0.6 },
    { url: `${BASE}/debate/rubric`, priority: 0.6 },
  ];
}
