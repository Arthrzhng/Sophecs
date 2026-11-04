import { createClient as createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { Page } from "@/components/layout/Page";
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
  type SchoolChangeCounts,
} from "@/lib/school-table";
import type { SchoolId } from "@/lib/types";
import { readAll } from "@/lib/read-all";
import { TABLE_SAMPLE_NOTE } from "@/lib/sample";

export const metadata = {
  title: "School table · Sophecs",
  description:
    "How each school argued this week, by the judge's fidelity mark. No names.",
};

// Empty rather than a zero per school: the counts are sparse, and
// rankSchools reads a missing school as nothing joined and nothing left.
const NO_CHANGES: SchoolChangeCounts = {};

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
  let includesSamples = false;

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
    // a migration this stage does not take. It is read out of the jsonb
    // rather than reading the whole verdict, which is most of the row.
    //
    // Both reads go through readAll: a plain select stops at the Data
    // API's 1,000 rows without saying so (src/lib/read-all.ts). On a
    // failed read the table shows the week as empty, as it did before.
    const [week_, histories, profile] = await Promise.all([
      readAll<{ user_id: string; school: SchoolId; fidelity: unknown; is_sample: boolean }>(
        (from, to) =>
          admin
            .from("debates")
            .select("user_id, school, fidelity:verdict->fidelity, is_sample", { count: "exact" })
            // Originals only. A revision is a second attempt at the same
            // motion after feedback and does not move the reader's rating,
            // so it does not move their school's row either. See
            // countsOnTable.
            .eq("kind", "original")
            .eq("rejected", false)
            .not("verdict", "is", null)
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString())
            .order("id")
            .range(from, to)
      ),
      // Only profiles that have changed school have anything to count.
      readAll<{ school_history: unknown }>((from, to) =>
        admin
          .from("profiles")
          .select("school_history", { count: "exact" })
          .neq("school_history", "[]")
          .order("id")
          .range(from, to)
      ),
      userId
        ? admin.from("profiles").select("school").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const rows = week_.rows ?? [];

    judged = rows.map((row) => ({
      school: row.school,
      fidelity: typeof row.fidelity === "number" ? row.fidelity : null,
    }));
    yoursThisWeek = userId ? rows.filter((row) => row.user_id === userId).length : 0;
    // Sample accounts (migration 0021) are counted like anyone else, and
    // the table says so in any week they are part of it.
    includesSamples = rows.some((row) => row.is_sample);

    const entries = (histories.rows ?? []).flatMap((p) =>
      Array.isArray(p.school_history) ? (p.school_history as SchoolChange[]) : []
    );
    changes = schoolChanges(entries, start, end);
    yourSchool = ((profile.data as { school?: SchoolId } | null)?.school ?? null) as SchoolId | null;
  }

  const rows = rankSchools(judged, changes);
  const paused =
    process.env.KILL_SWITCH_JUDGE === "true" && !(userId && isJudgeAllowlisted(userId));

  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="ui" rhythm="path">
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
          sampleNote={includesSamples ? TABLE_SAMPLE_NOTE : null}
        />
    </Page>
  );
}
