import "server-only";
import { createClient as createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import type { SchoolTableProps } from "@/components/table/SchoolTable";
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

// Empty rather than a zero per school: the counts are sparse, and
// rankSchools reads a missing school as nothing joined and nothing left.
const NO_CHANGES: SchoolChangeCounts = {};

/**
 * What the school table shows this week, read for the page that shows it:
 * `/table`, and on a SIX_SCHOOLS build `/schools`, which shows it under the
 * schools' cards (Arthur, 2026-11-06). Moved here unchanged from
 * src/app/table/page.tsx so the two cannot drift apart.
 *
 * Entirely derived from rows that already exist: this week's judged
 * debates and profiles.school_history. No new column, no standings to keep
 * in step, and nothing written. A page calling this reads cookies, so it is
 * dynamic; it says so itself (`export const dynamic`).
 */
export async function loadSchoolTable(): Promise<SchoolTableProps> {
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
      readAll<{ school_history: unknown; is_sample: boolean }>((from, to) =>
        admin
          .from("profiles")
          .select("school_history, is_sample", { count: "exact" })
          .neq("school_history", "[]")
          .order("id")
          .range(from, to)
      ),
      userId
        ? admin.from("profiles").select("school").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // A failed read shows the week as empty, as before, and says why in the log.
    if (week_.error) console.error("[table] week of debates:", week_.error);
    if (histories.error) console.error("[table] school changes:", histories.error);
    const rows = week_.rows ?? [];

    judged = rows.map((row) => ({
      school: row.school,
      fidelity: typeof row.fidelity === "number" ? row.fidelity : null,
    }));
    yoursThisWeek = userId ? rows.filter((row) => row.user_id === userId).length : 0;
    const entries = (histories.rows ?? []).flatMap((p) =>
      Array.isArray(p.school_history) ? (p.school_history as SchoolChange[]) : []
    );
    // Sample accounts (migration 0023) are counted like anyone else, in
    // both the arguments and the joined and left columns, and the table
    // says so in any week either includes one.
    const inWeek = (at: string) => Date.parse(at) >= start.getTime() && Date.parse(at) < end.getTime();
    includesSamples =
      rows.some((row) => row.is_sample) ||
      (histories.rows ?? []).some(
        (p) => p.is_sample && Array.isArray(p.school_history) && (p.school_history as SchoolChange[]).some((e) => inWeek(e.at))
      );
    changes = schoolChanges(entries, start, end);
    yourSchool = ((profile.data as { school?: SchoolId } | null)?.school ?? null) as SchoolId | null;
  }

  return {
    week,
    rows: rankSchools(judged, changes),
    yourSchool,
    // Only where there is a school to write it about. A signed-out
    // reader, or one who has not taken the quiz, gets the table
    // without a line claiming anything about them.
    yourLine: yourSchool ? yourTableLine(yoursThisWeek, SCHOOL_COLORS[yourSchool].name) : null,
    emptyWeek: judged.length === 0,
    paused:
      process.env.KILL_SWITCH_JUDGE === "true" && !(userId && isJudgeAllowlisted(userId)),
    sampleNote: includesSamples ? TABLE_SAMPLE_NOTE : null,
  };
}
