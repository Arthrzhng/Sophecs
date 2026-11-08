import type { MetadataRoute } from "next";
import { getAllTopicFiles } from "@/lib/topics";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { SHOWN_SCHOOL_IDS } from "@/lib/school-registry";

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

  // The before and after passages only. An "elsewhere" passage loads on a
  // SIX_SCHOOLS build, which serves its page, but its file still marks it a
  // draft, so it is not offered to search engines.
  const lessons = getAllMicroLessons()
    .filter((lesson) => lesson.position !== "elsewhere")
    .map((lesson) => ({
      url: `${BASE}/lessons/${lesson.slug}`,
      priority: 0.5,
    }));

  return [
    { url: BASE, priority: 1 },
    { url: `${BASE}/quiz`, priority: 0.9 },
    // Every school this build shows, in registry order, which is the order
    // /s/[school] generates its static params in: production's six since
    // the launch, and the original three on a build without the flag.
    ...SHOWN_SCHOOL_IDS.map((school) => ({
      url: `${BASE}/s/${school}`,
      priority: 0.8,
    })),
    { url: `${BASE}/debate`, priority: 0.7 },
    ...topics,
    { url: `${BASE}/lessons`, priority: 0.5 },
    ...lessons,
    // Both were public and unlisted. A product that scores a teenager's
    // reasoning should have the pages explaining the scoring findable.
    // On a SIX_SCHOOLS build the two are one page, and the table is
    // under the schools' cards (docs/daily-path-copy.md, section 13).
    ...(process.env.SIX_SCHOOLS === "1"
      ? [
          { url: `${BASE}/how-it-works`, priority: 0.6 },
          { url: `${BASE}/schools`, priority: 0.6 },
        ]
      : [
          { url: `${BASE}/method`, priority: 0.6 },
          { url: `${BASE}/debate/rubric`, priority: 0.6 },
        ]),
  ];
}
