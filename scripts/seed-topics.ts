// Upserts content/topics/*.md into debate_topics. Run whenever Arthur adds
// or edits a topic file — content changes don't need a migration.
//
//   npm run seed:topics
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (npm run seed:topics loads .env.local via Node's --env-file).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getAllTopicFiles } from "../src/lib/topics";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const topics = getAllTopicFiles();
  if (topics.length === 0) {
    console.log("No files in content/topics/ yet — nothing to seed.");
    return;
  }

  const microDir = path.join(process.cwd(), "content", "micro");
  const microSlugs = fs.existsSync(microDir)
    ? fs
        .readdirSync(microDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""))
    : [];

  for (const topic of topics) {
    for (const microSlug of [topic.micro_before, topic.micro_after]) {
      if (!microSlugs.includes(microSlug)) {
        console.warn(`  ⚠ ${topic.slug}: micro-lesson "${microSlug}" not found in content/micro/`);
      }
    }

    // par_elo/par_n are deliberately not in this payload — they're written
    // only by /api/judge as real debates happen, never reset by a content edit.
    const { error } = await admin.from("debate_topics").upsert(
      {
        slug: topic.slug,
        title: topic.title,
        motion: topic.motion,
        stances: topic.stances,
        micro_before: topic.micro_before,
        micro_after: topic.micro_after,
        sort: topic.sort ?? 0,
        active: topic.active ?? true,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`  ✗ ${topic.slug}: ${error.message}`);
    } else {
      console.log(`  ✓ ${topic.slug}`);
    }
  }
}

main();
