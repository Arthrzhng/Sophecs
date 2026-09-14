import type { MetadataRoute } from "next";
import { getAllTopicFiles } from "@/lib/topics";
import { getAllMicroLessons } from "@/lib/micro-lessons";

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
    { url: `${BASE}/s/stoicism`, priority: 0.8 },
    { url: `${BASE}/s/utilitarianism`, priority: 0.8 },
    { url: `${BASE}/s/virtue-ethics`, priority: 0.8 },
    { url: `${BASE}/debate`, priority: 0.7 },
    ...topics,
    { url: `${BASE}/lessons`, priority: 0.5 },
    ...lessons,
  ];
}
