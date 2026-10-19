// Puts a snapshot of debate_topics back.
//
//   npm run restore:topics -- docs/seed-snapshots/2026-10-19-debate-topics.json
//   npm run restore:topics -- <snapshot> --write
//
// Dry run unless --write is passed. The default is deliberate: this is the
// undo for a seed, and the moment you want it is the moment you are least
// inclined to read the output first.
//
// It writes the same fields the seeder writes and no others. par_elo and
// par_n are recorded in the snapshot for reference and are never written
// back: /api/judge owns them, and putting the wording back is not a reason
// to rewind anybody's debates.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { restoreDiff, SEEDED_FIELDS, type TopicRow } from "../src/lib/topic-seed-diff";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const args = process.argv.slice(2);
const write = args.includes("--write");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Usage: npm run restore:topics -- <snapshot.json> [--write]");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

function show(value: unknown): string {
  return value === undefined ? "(no row)" : JSON.stringify(value);
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(file!, "utf8")) as {
    taken_at?: string;
    rows: TopicRow[];
  };
  const rowsWanted = snapshot.rows ?? [];

  console.log(`Snapshot ${file}${snapshot.taken_at ? ` taken ${snapshot.taken_at}` : ""}`);
  console.log(`Target   ${url}`);
  console.log(write ? "MODE     write\n" : "MODE     dry run, nothing will be written\n");

  const { data, error } = await admin
    .from("debate_topics")
    .select("slug, title, motion, stances, micro_before, micro_after, sort, active");
  if (error) {
    console.error(`Could not read debate_topics: ${error.message}`);
    process.exit(1);
  }

  const diff = restoreDiff(rowsWanted, (data ?? []) as TopicRow[]);
  const changed = diff.topics.filter((t) => t.kind !== "unchanged");

  for (const topic of diff.topics) {
    if (topic.kind === "unchanged") {
      console.log(`  = ${topic.slug}: already matches the snapshot`);
      continue;
    }
    console.log(`\n  ${topic.kind === "insert" ? "INSERT" : "RESTORE"} ${topic.slug}`);
    for (const change of topic.changes) {
      console.log(`      ${change.field}`);
      console.log(`        now:      ${show(change.before)}`);
      console.log(`        snapshot: ${show(change.after)}`);
    }
  }

  if (diff.orphanedSlugs.length > 0) {
    console.log(
      `\n  Rows the snapshot does not cover (left alone): ${diff.orphanedSlugs.join(", ")}`
    );
  }

  console.log(`\n${changed.length} of ${diff.topics.length} rows differ from the snapshot.`);

  if (!write) {
    console.log("Dry run. Re-run with --write to put the snapshot back.");
    return;
  }
  if (changed.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  for (const topic of changed) {
    const row = rowsWanted.find((r) => r.slug === topic.slug)!;
    const payload = Object.fromEntries([
      ["slug", row.slug],
      ...SEEDED_FIELDS.map((f) => [f, row[f]]),
    ]);
    const { error: writeError } = await admin
      .from("debate_topics")
      .upsert(payload, { onConflict: "slug" });
    console.log(writeError ? `  ✗ ${topic.slug}: ${writeError.message}` : `  ✓ ${topic.slug}`);
  }
}

main();
