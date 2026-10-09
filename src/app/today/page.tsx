import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates } from "@/lib/cases";
import { getMicroLesson } from "@/lib/micro-lessons";
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
import { SCHOOL_IDS, type SchoolId } from "@/lib/types";

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
  if (!school) redirect("/quiz?next=/today");

  // The same read /api/judge makes, so the locks lift on their own when the
  // switch comes off rather than needing a second place to be updated.
  const paused = !isJudgeAllowlisted(user.id) && process.env.KILL_SWITCH_JUDGE === "true";
  const streak = Number(profile?.streak ?? 0);

  // Sorted by school in the same order the lessons index sorts by, so
  // "the next module" is the same module on both screens, and split by the
  // same function, so the two can never disagree about how many readings
  // one has.
  const modules: LessonsCardModule[] = getAllModules()
    .sort((a, b) => SCHOOL_IDS.indexOf(a.school) - SCHOOL_IDS.indexOf(b.school))
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
    // columns through the same rankSchools, not by a second tally.
    admin
      .from("debates")
      .select("school, verdict")
      .eq("kind", "original")
      .eq("rejected", false)
      .not("verdict", "is", null)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
  ]);
  const topics = topicRows.data;

  const judged: JudgedArgument[] = (
    (judgedRows.data ?? []) as { school: SchoolId; verdict: { fidelity?: number | null } | null }[]
  ).map((row) => ({
    school: row.school,
    fidelity: typeof row.verdict?.fidelity === "number" ? row.verdict.fidelity : null,
  }));

  // Joined and left are the table's own columns and play no part in the
  // order, which is average fidelity then argument count. Passing zeroes
  // gives the same ranks and saves reading school_history for every
  // profile in the database to draw one line in a sidebar.
  const ranks = rankSchools(
    judged,
    Object.fromEntries(SCHOOL_IDS.map((s) => [s, { joined: 0, left: 0 }])) as Record<
      SchoolId,
      { joined: number; left: number }
    >
  );

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
    >
      {sidebar}
    </TodayClient>
  );
}
