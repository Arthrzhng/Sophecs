import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates } from "@/lib/cases";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getSchool } from "@/lib/schools";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { TodayClient } from "@/components/today/TodayClient";
import { StreakCard, SchoolCard, LessonsCard } from "@/components/today/TodayCards";
import { EmptyState } from "@/components/ui/EmptyState";
import { Page } from "@/components/layout/Page";
import type { SchoolId } from "@/lib/types";

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
    .select("school, streak")
    .eq("id", user.id)
    .maybeSingle();

  const school = (profile?.school as SchoolId | null) ?? null;
  if (!school) redirect("/quiz?next=/today");

  // The same read /api/judge makes, so the locks lift on their own when the
  // switch comes off rather than needing a second place to be updated.
  const paused = !isJudgeAllowlisted(user.id) && process.env.KILL_SWITCH_JUDGE === "true";
  const streak = Number(profile?.streak ?? 0);

  const sidebar = (
    <>
      <StreakCard streak={streak} paused={paused} />
      <SchoolCard school={school} oneLine={getSchool(school).one_line} />
      <LessonsCard />
    </>
  );

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
  const { data: topics } = await admin
    .from("debate_topics")
    .select("slug, title, motion, micro_before, sort, active")
    .eq("active", true);

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
