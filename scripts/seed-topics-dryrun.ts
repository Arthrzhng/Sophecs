// What `npm run seed:topics` would change, printed, writing nothing.
//
//   npm run seed:topics:dryrun
//
// Reads content/topics/*.md and the current debate_topics rows and prints
// the two side by side, field by field. The client is created with the
// same credentials the real seeder uses, and this script issues SELECTs
// only. Nothing here calls upsert, insert, update or delete.
//
// It exists because the seed is the one step in the content pipeline with
// no preview and no undo: a reworded motion goes straight into the table
// the running app reads.
import { createClient } from "@supabase/supabase-js";
import { getAllTopicFiles } from "../src/lib/topics";
import { seedDiff, type TopicRow } from "../src/lib/topic-seed-diff";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

function show(value: unknown): string {
  if (value === undefined) return "(no row)";
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value);
}

async function main() {
  console.log(`Dry run against ${url}`);
  console.log("Nothing is written. This reads two things and prints the difference.\n");

  const topics = getAllTopicFiles();
  if (topics.length === 0) {
    console.log("No files in content/topics/ — nothing to compare.");
    return;
  }

  const { data, error } = await admin
    .from("debate_topics")
    .select("slug, title, motion, stances, micro_before, micro_after, sort, active");

  if (error) {
    console.error(`Could not read debate_topics: ${error.message}`);
    process.exit(1);
  }

  const diff = seedDiff(topics, (data ?? []) as TopicRow[]);

  for (const topic of diff.topics) {
    if (topic.kind === "unchanged") {
      console.log(`  = ${topic.slug}: no change`);
      continue;
    }
    const label = topic.kind === "insert" ? "INSERT" : "UPDATE";
    console.log(`\n  ${label} ${topic.slug}`);
    for (const change of topic.changes) {
      console.log(`      ${change.field}`);
      console.log(`        old: ${show(change.before)}`);
      console.log(`        new: ${show(change.after)}`);
    }
  }

  if (diff.orphanedSlugs.length > 0) {
    console.log(
      `\n  Rows no file claims (the seeder leaves these alone): ${diff.orphanedSlugs.join(", ")}`
    );
  }

  const changed = diff.topics.filter((t) => t.kind !== "unchanged");
  console.log(
    `\n${changed.length} of ${diff.topics.length} rows would change. par_elo and par_n are not in the payload and are not touched.`
  );
}

main();
