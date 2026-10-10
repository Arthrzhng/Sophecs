import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getEloPercentile } from "@/lib/percentile";
import { ratingByWeek, type RatingPoint } from "@/lib/rating-history";
import { getPendingChallenges } from "@/lib/challenge";
import { getOpenObjections, type OpenObjection } from "@/lib/objections";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates, type CaseState } from "@/lib/cases";
import { isLapsed } from "@/lib/counterpart";
import type { ExchangeRow } from "@/components/me/OpenExchanges";
import { WelcomeTracker } from "@/components/me/WelcomeTracker";
import { MeViewTracker } from "@/components/me/MeViewTracker";
import { ProfilePage } from "@/components/me/ProfilePage";
import { todayUTC } from "@/lib/streak";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Me · Sophecs" };

interface ProfileRow {
  display_name: string | null;
  school: SchoolId | null;
  elo: number;
  streak: number;
  // The judge writes both. The number alone cannot say whether the run is
  // still going, which is why the block reads them together.
  streak_updated_on: string | null;
}

interface DebateHistoryRow {
  id: string;
  topic_slug: string;
  score: number | null;
  rejected: boolean;
  created_at: string;
  kind: "original" | "revision";
  parent_debate_id: string | null;
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, school, elo, streak, streak_updated_on")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const school = profile?.school ?? null;
  const elo = profile?.elo ?? 1200;
  const streak = profile?.streak ?? 0;
  const streakUpdatedOn = profile?.streak_updated_on ?? null;
  const method = user.app_metadata?.provider === "google" ? "google" : "magic";

  // quiz_results' RLS only allows anon_id-header reads, not auth.uid() —
  // signed-in users can't read their own claimed rows directly (a gap
  // outside 2a/2b's scope; see docs/decisions.md). Admin client here for
  // the one-off id this event needs, and for the debate-facing data below.
  let claimedResultId = "";
  let percentile = 0;
  let pendingChallenges: Awaited<ReturnType<typeof getPendingChallenges>> = [];
  let debateHistory: DebateHistoryRow[] = [];
  let revisionByParent = new Map<string, DebateHistoryRow>();
  let caseStates: Record<string, CaseState> = {};
  let allClosed = false;
  let exchanges: ExchangeRow[] = [];
  let openObjections: OpenObjection[] = [];
  let weeklyMotion: { slug: string; title: string; sort: number } | null = null;
  let hasAnyDebate = false;
  let ratingPoints: RatingPoint[] = [];

  if (isAdminConfigured()) {
    const admin = createAdminClient();

    if (welcome === "1" && school) {
      const { data: latest } = await admin
        .from("quiz_results")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      claimedResultId = latest?.id ?? "";
    }

    const [percentileValue, pending, history, objectionRows, activeTopics, ratings] =
      await Promise.all([
      getEloPercentile(user.id, elo),
      getPendingChallenges(admin, user.id),
      // Originals only: each revision is looked up separately and rendered
      // underneath its parent, so a revision never eats one of the five
      // slots and never appears detached from the argument it answers.
      admin
        .from("debates")
        .select("id, topic_slug, score, rejected, created_at, kind, parent_debate_id")
        .eq("user_id", user.id)
        .eq("kind", "original")
        .order("created_at", { ascending: false })
        .limit(5),
      getOpenObjections(admin, user.id),
      admin
        .from("debate_topics")
        .select("slug, title, sort, micro_before")
        .eq("active", true)
        .order("sort", { ascending: true }),
      // Originals only, and only the two fields the chart plots: a
      // revision does not move the rating (the verdict page says so), so
      // including one would draw a point where nothing changed.
      admin
        .from("debates")
        .select("created_at, elo_after")
        .eq("user_id", user.id)
        .eq("kind", "original")
        .not("elo_after", "is", null)
        .order("created_at", { ascending: true }),
    ]);
    percentile = percentileValue;
    ratingPoints = ratingByWeek(
      ((ratings.data as { created_at: string; elo_after: number | null }[] | null) ?? []).map(
        (row) => ({ created_at: row.created_at, elo_after: Number(row.elo_after) })
      )
    );
    pendingChallenges = pending;
    debateHistory = (history.data as DebateHistoryRow[] | null) ?? [];
    openObjections = objectionRows;
    hasAnyDebate = debateHistory.length > 0;

    if (debateHistory.length > 0) {
      const { data: revisions } = await admin
        .from("debates")
        .select("id, topic_slug, score, rejected, created_at, kind, parent_debate_id")
        .eq("user_id", user.id)
        .eq("kind", "revision")
        .in(
          "parent_debate_id",
          debateHistory.map((d) => d.id)
        );
      revisionByParent = new Map(
        ((revisions as DebateHistoryRow[] | null) ?? []).map((r) => [r.parent_debate_id!, r])
      );
    }

    const activeRows = (activeTopics.data ?? []).map((t) => ({
      slug: t.slug as string,
      microBefore: (t.micro_before as string | null) ?? null,
    }));
    // Open exchanges, with lapsed ones filtered out rather than closed
    // here: closing is the exchange page's job, on view, and /me should not
    // be writing rows as a side effect of rendering.
    const { data: exchangeRows } = await admin
      .from("exchanges")
      .select("id, topic_slug, user_a, school_a, school_b, next_turn, last_turn_at")
      .eq("status", "open")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_turn_at", { ascending: false });
    const titleBySlug = new Map(
      (activeTopics.data ?? []).map((t) => [t.slug as string, t.title as string])
    );
    exchanges = (exchangeRows ?? [])
      .filter((row) => !isLapsed(row.last_turn_at as string))
      .map((row) => ({
        id: row.id as string,
        topicTitle: titleBySlug.get(row.topic_slug as string) ?? (row.topic_slug as string),
        theirSchool: (row.user_a === user.id ? row.school_b : row.school_a) as SchoolId,
        myTurn: row.next_turn === user.id,
      }));

    caseStates = await getCaseStates(admin, user.id, activeRows);
    // Six of six closed is the only completion signal in the product: one
    // line, no badge, no certificate, and it says what to do next rather
    // than congratulating.
    allClosed =
      activeRows.length > 0 && activeRows.every((t) => caseStates[t.slug]?.closed);
    weeklyMotion = getWeeklyMotion(
      (activeTopics.data ?? []).map((t) => ({
        slug: t.slug as string,
        title: t.title as string,
        sort: Number(t.sort),
      }))
    );
  }

  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; five other routes do the
  // same, and they all go back to <Page> in the stage that deletes it.
  return (
    <main className="flex-1" data-daily-path>
      <MeViewTracker openObjections={openObjections.length} />
      <WelcomeTracker
        active={welcome === "1"}
        userId={user.id}
        method={method}
        school={school}
        resultId={claimedResultId}
      />
      <ProfilePage
        school={school}
        displayName={profile?.display_name ?? null}
        elo={elo}
        percentile={percentile}
        streak={streak}
        streakUpdatedOn={streakUpdatedOn}
        today={todayUTC()}
        ratingPoints={ratingPoints}
        objections={openObjections}
        weeklyMotion={weeklyMotion}
        hasAnyDebate={hasAnyDebate}
        exchanges={exchanges}
        pendingChallenges={pendingChallenges}
        debates={debateHistory.map((d) => {
          const revision = revisionByParent.get(d.id);
          return {
            id: d.id,
            topicSlug: d.topic_slug,
            score: d.score,
            rejected: d.rejected,
            revision: revision
              ? {
                  id: revision.id,
                  topicSlug: revision.topic_slug,
                  score: revision.score,
                  rejected: revision.rejected,
                }
              : undefined,
          };
        })}
        caseStates={caseStates}
        allClosed={allClosed}
      />
    </main>
  );
}
