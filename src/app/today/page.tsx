import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates } from "@/lib/cases";
import { getAllMicroLessons, getMicroLesson } from "@/lib/micro-lessons";
import { ElsewhereCard } from "@/components/phase3/ElsewhereCard";
import { getSchool } from "@/lib/schools";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { TodayClient } from "@/components/today/TodayClient";
import { StreakCard, SchoolCard } from "@/components/today/TodayCards";
import { LessonsCard, type LessonsCardModule } from "@/components/today/LessonsCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Page } from "@/components/layout/Page";
import { getAllModules } from "@/lib/modules";
import { splitModule } from "@/lib/module-readings";
import { isoWeekRange, rankSchools, type JudgedArgument } from "@/lib/school-table";
import { todayUTC } from "@/lib/streak";
import { readAll } from "@/lib/read-all";
import { SHOWN_SCHOOL_IDS, type SchoolId } from "@/lib/types";

export const metadata = {
  title: "Today · Sophecs",
  description: "This week's motion, and the six steps from the passage to a closed case.",
};

/**
 * The signed-in home: one week, one motion, six steps.
 *
 * At /today rather than at /, per docs/daily-path-copy.md Q8. The landing
 * page stays static, which docs/decisions.md records as a deliberate
 * decision: a session read in the root layout would make every page in the
 * product dynamic, including the ones whose speed was measured.
 */
export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/today");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school, streak, streak_updated_on, elo")
    .eq("id", user.id)
    .maybeSingle();

  const school = (profile?.school as SchoolId | null) ?? null;
  // A school this build does not show has no card or content to draw here:
  // one of the three, on a build without SIX_SCHOOLS deployed to revert the
  // launch. The reader takes this build's quiz, as one with no school does.
  if (!school || !SHOWN_SCHOOL_IDS.includes(school)) redirect("/quiz?next=/today");

  // The same read /api/judge makes, so the locks lift on their own when the
  // switch comes off rather than needing a second place to be updated.
  const paused = !isJudgeAllowlisted(user.id) && process.env.KILL_SWITCH_JUDGE === "true";
  const streak = Number(profile?.streak ?? 0);

  // Sorted by school in the same order the lessons index sorts by, so
  // "the next module" is the same module on both screens, and split by the
  // same function, so the two can never disagree about how many readings
  // one has.
  const modules: LessonsCardModule[] = getAllModules()
    .sort(
      (a, b) =>
        SHOWN_SCHOOL_IDS.indexOf(a.school) - SHOWN_SCHOOL_IDS.indexOf(b.school)
    )
    .map((m) => ({
      id: m.id,
      title: m.title,
      readings: splitModule(m.title, m.body, m.readings).length,
    }));

  // Without Supabase configured there is no topic table to pick a motion
  // from. Say so rather than rendering a path with nothing behind it.
  if (!isAdminConfigured()) {
    return (
      <Page width="ui">
        <EmptyState
          title="This week's motion could not be loaded."
          body="This is on our side, not yours. The lessons and the case for your school are unaffected."
        />
      </Page>
    );
  }

  const admin = createAdminClient();
  const { start, end } = isoWeekRange(new Date());

  const [topicRows, judgedRows] = await Promise.all([
    admin
      .from("debate_topics")
      .select("slug, title, motion, micro_before, sort, active")
      .eq("active", true),
    // The same rows the school table counts: originals, not rejected,
    // judged, inside this ISO week. Kept in step by reading the same
    // columns through the same rankSchools, not by a second tally, and
    // through readAll, as the table does, so a week of more than 1,000
    // arguments is counted whole (src/lib/read-all.ts).
    readAll<{ school: SchoolId; fidelity: unknown }>((from, to) =>
      admin
        .from("debates")
        .select("school, fidelity:verdict->fidelity", { count: "exact" })
        .eq("kind", "original")
        .eq("rejected", false)
        .not("verdict", "is", null)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("id")
        .range(from, to)
    ),
  ]);
  const topics = topicRows.data;
  if (judgedRows.error) console.error("[today] week of debates:", judgedRows.error);

  const judged: JudgedArgument[] = (judgedRows.rows ?? []).map((row) => ({
    school: row.school,
    fidelity: typeof row.fidelity === "number" ? row.fidelity : null,
  }));

  // Joined and left are the table's own columns and play no part in the
  // order, which is average fidelity then argument count. Passing zeroes
  // gives the same ranks and saves reading school_history for every
  // profile in the database to draw one line in a sidebar.
  const ranks = rankSchools(judged, {});

  const sidebar = (
    <>
      <StreakCard
        streak={streak}
        streakUpdatedOn={(profile?.streak_updated_on as string | null) ?? null}
        today={todayUTC()}
        paused={paused}
      />
      <SchoolCard
        school={school}
        oneLine={getSchool(school).one_line}
        elo={Number(profile?.elo ?? 1200)}
        rank={ranks.find((r) => r.school === school)?.rank ?? null}
      />
      <LessonsCard modules={modules} />
    </>
  );

  const weekly = getWeeklyMotion(
    (topics ?? []).map((t) => ({
      slug: t.slug as string,
      title: t.title as string,
      sort: Number(t.sort),
    }))
  );

  if (!weekly) {
    return (
      <Page width="ui">
        <EmptyState
          title="This week's motion could not be loaded."
          body="This is on our side, not yours. The lessons and the case for your school are unaffected."
        />
      </Page>
    );
  }

  const row = (topics ?? []).find((t) => t.slug === weekly.slug);
  const microBeforeSlug = (row?.micro_before as string | undefined) ?? null;
  const lesson = microBeforeSlug ? getMicroLesson(microBeforeSlug) : null;
  // The week's view from elsewhere, which only a SIX_SCHOOLS build loads.
  const elsewhere =
    getAllMicroLessons().find((l) => l.topic === weekly.slug && l.position === "elsewhere") ?? null;

  const states = await getCaseStates(admin, user.id, [
    { slug: weekly.slug, microBefore: microBeforeSlug },
  ]);
  const state = states[weekly.slug];

  return (
    <TodayClient
      slug={weekly.slug}
      motionTitle={weekly.title}
      school={school}
      progress={{
        read: state.read,
        argued: state.argued,
        answered: state.answered,
        closed: state.closed,
      }}
      paused={paused}
      userId={user.id}
      passage={lesson?.body ?? ""}
      passageSource={
        lesson
          ? `${lesson.source.author}, ${lesson.source.work}, ${lesson.source.section}`
          : ""
      }
      elsewhere={elsewhere ? <ElsewhereCard lesson={elsewhere} /> : undefined}
    >
      {sidebar}
    </TodayClient>
  );
}
