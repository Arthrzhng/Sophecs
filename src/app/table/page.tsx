import { createClient as createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { SchoolTable } from "@/components/table/SchoolTable";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import {
  isoWeekRange,
  rankSchools,
  schoolChanges,
  yourTableLine,
  type JudgedArgument,
  type SchoolChange,
} from "@/lib/school-table";
import { SCHOOL_IDS, type SchoolId } from "@/lib/types";

export const metadata = {
  title: "School table · Sophecs",
  description:
    "How each school argued this week, by the judge's fidelity mark. No names.",
};

const NO_CHANGES = Object.fromEntries(
  SCHOOL_IDS.map((s) => [s, { joined: 0, left: 0 }])
) as Record<SchoolId, { joined: number; left: number }>;

/*
 * Declared dynamic rather than left to be inferred.
 *
 * The session read below is behind isSupabaseConfigured(), so a build run
 * without those variables never calls cookies() and Next prerenders the
 * route — baking an empty table and a signed-out view into the deployment.
 * It happens to be right on Vercel, where the variables are set at build
 * time too, and that is exactly the kind of correctness nobody notices
 * breaking.
 *
 * Entirely derived from rows that already exist: this week's judged
 * debates and profiles.school_history. No new column, no standings to keep
 * in step, and nothing written.
 */
export const dynamic = "force-dynamic";

export default async function SchoolTablePage() {
  const { start, end, week } = isoWeekRange(new Date());

  let yourSchool: SchoolId | null = null;
  let userId: string | null = null;
  let judged: JudgedArgument[] = [];
  let changes = NO_CHANGES;
  let yoursThisWeek = 0;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (isAdminConfigured()) {
    const admin = createAdminClient();

    // The verdict's fidelity is inside the jsonb; only `score` is
    // denormalized onto its own column, and adding a second one would be
    // a migration this stage does not take.
    const [week_, histories, profile] = await Promise.all([
      admin
        .from("debates")
        .select("user_id, school, verdict")
        // Originals only. A revision is a second attempt at the same
        // motion after feedback and does not move the reader's rating, so
        // it does not move their school's row either. See countsOnTable.
        .eq("kind", "original")
        .eq("rejected", false)
        .not("verdict", "is", null)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
      admin.from("profiles").select("school_history"),
      userId
        ? admin.from("profiles").select("school").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const rows = (week_.data ?? []) as {
      user_id: string;
      school: SchoolId;
      verdict: { fidelity?: number | null } | null;
    }[];

    judged = rows.map((row) => ({
      school: row.school,
      fidelity: typeof row.verdict?.fidelity === "number" ? row.verdict.fidelity : null,
    }));
    yoursThisWeek = userId ? rows.filter((row) => row.user_id === userId).length : 0;

    const entries = ((histories.data ?? []) as { school_history: unknown }[]).flatMap(
      (p) => (Array.isArray(p.school_history) ? (p.school_history as SchoolChange[]) : [])
    );
    changes = schoolChanges(entries, start, end);
    yourSchool = ((profile.data as { school?: SchoolId } | null)?.school ?? null) as SchoolId | null;
  }

  const rows = rankSchools(judged, changes);
  const paused =
    process.env.KILL_SWITCH_JUDGE === "true" && !(userId && isJudgeAllowlisted(userId));

  return (
    <main className="flex-1" data-daily-path>
      <div className="mx-auto max-w-ui px-6 py-10">
        <SchoolTable
          week={week}
          rows={rows}
          yourSchool={yourSchool}
          // Only where there is a school to write it about. A signed-out
          // reader, or one who has not taken the quiz, gets the table
          // without a line claiming anything about them.
          yourLine={
            yourSchool
              ? yourTableLine(yoursThisWeek, SCHOOL_COLORS[yourSchool].name)
              : null
          }
          emptyWeek={judged.length === 0}
          paused={paused}
        />
      </div>
    </main>
  );
}
