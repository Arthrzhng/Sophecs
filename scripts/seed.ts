/**
 * Seeds a Supabase project with the same rows the fixture layer serves in
 * local development: 3 schools, 2 motions with micro-lessons, 3 placeholder
 * quiz questions, and enough fake profiles, submissions, threads, and posts
 * that every screen renders populated.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Fixture profile ids like "p-halcyon" are placeholders; real profiles hang
 * off auth.users, so this script creates auth users first and maps ids.
 */
import { createClient } from "@supabase/supabase-js";
import { SCHOOLS } from "../src/lib/schools";
import {
  FIXTURE_DEFECTIONS,
  FIXTURE_MATCHES,
  FIXTURE_MICRO_LESSONS,
  FIXTURE_MOTIONS,
  FIXTURE_POSTS,
  FIXTURE_PROFILES,
  FIXTURE_QUIZ_OPTIONS,
  FIXTURE_QUIZ_QUESTIONS,
  FIXTURE_SUBMISSIONS,
  FIXTURE_THREADS,
  FIXTURE_VERDICTS,
} from "../src/lib/data/fixtures";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function insert(table: string, rows: unknown[]) {
  const { error } = await supabase.from(table).upsert(rows as never[]);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows`);
}

async function main() {
  await insert("schools", Object.values(SCHOOLS));
  await insert("quiz_questions", FIXTURE_QUIZ_QUESTIONS);
  await insert("quiz_options", FIXTURE_QUIZ_OPTIONS);
  await insert("motions", FIXTURE_MOTIONS);
  await insert("micro_lessons", FIXTURE_MICRO_LESSONS);

  // Fake profiles need real auth users behind them.
  const idMap = new Map<string, string>();
  for (const profile of FIXTURE_PROFILES) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `${profile.username}@seed.sophecs.invalid`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`auth user ${profile.username}: ${error?.message}`);
    idMap.set(profile.id, data.user.id);
  }
  // Submissions may come from "system"; that id passes through unchanged.
  const mapId = (id: string) => idMap.get(id) ?? id;

  await insert(
    "profiles",
    FIXTURE_PROFILES.map((p) => ({ ...p, id: mapId(p.id) }))
  );
  await insert(
    "submissions",
    FIXTURE_SUBMISSIONS.map((s) => ({ ...s, profile_id: mapId(s.profile_id) }))
  );
  await insert("matches", FIXTURE_MATCHES);
  await insert("verdicts", FIXTURE_VERDICTS);
  await insert(
    "defections",
    FIXTURE_DEFECTIONS.map((d) => ({ ...d, profile_id: mapId(d.profile_id) }))
  );
  await insert(
    "threads",
    FIXTURE_THREADS.map((t) => ({ ...t, profile_id: mapId(t.profile_id) }))
  );
  await insert(
    "posts",
    FIXTURE_POSTS.map((p) => ({ ...p, profile_id: mapId(p.profile_id) }))
  );

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
