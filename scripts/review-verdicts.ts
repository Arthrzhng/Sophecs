// Prints the last N judged debates one per screen, for the "reviewed 20
// real verdicts" gate before flipping KILL_SWITCH_JUDGE off. Each screen:
// motion, school, the full argument, then the verdict JSON. Press Enter to
// advance, or 'q' to quit early.
//
//   npm run review:verdicts -- 20
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (loaded
// from .env.local by the npm script).
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

interface Row {
  id: string;
  school: string;
  argument: string;
  verdict: unknown;
  created_at: string;
  debate_topics: { motion: string } | { motion: string }[] | null;
}

function motionOf(row: Row): string {
  const t = row.debate_topics;
  if (!t) return "(unknown motion)";
  return Array.isArray(t) ? (t[0]?.motion ?? "(unknown motion)") : t.motion;
}

async function main() {
  const n = Number(process.argv[2]) || 20;

  const { data, error } = await admin
    .from("debates")
    .select("id, school, argument, verdict, created_at, debate_topics(motion)")
    .not("verdict", "is", null)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log("No judged debates yet.");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.clear();
    console.log(`Verdict ${i + 1} / ${rows.length} — ${row.created_at}\n`);
    console.log(`Motion: ${motionOf(row)}`);
    console.log(`School: ${row.school}\n`);
    console.log("--- argument ---");
    console.log(row.argument);
    console.log("\n--- verdict ---");
    console.log(JSON.stringify(row.verdict, null, 2));
    console.log("");

    if (i < rows.length - 1) {
      const answer = await rl.question("Enter for next, 'q' to quit... ");
      if (answer.trim().toLowerCase() === "q") break;
    }
  }

  rl.close();
}

main();
