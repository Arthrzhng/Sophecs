import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getEloPercentile } from "@/lib/percentile";
import { getPendingChallenges } from "@/lib/challenge";
import { DisplayNameForm } from "@/components/me/DisplayNameForm";
import { WelcomeTracker } from "@/components/me/WelcomeTracker";
import { MeViewTracker } from "@/components/me/MeViewTracker";
import { EloBlock } from "@/components/me/EloBlock";
import { StreakBlock } from "@/components/me/StreakBlock";
import { PendingChallenges } from "@/components/me/PendingChallenges";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Me · Sophecs" };

interface ProfileRow {
  display_name: string | null;
  school: SchoolId | null;
  elo: number;
  streak: number;
}

interface DebateHistoryRow {
  id: string;
  topic_slug: string;
  score: number | null;
  rejected: boolean;
  created_at: string;
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
    .select("display_name, school, elo, streak")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const school = profile?.school ?? null;
  const elo = profile?.elo ?? 1200;
  const streak = profile?.streak ?? 0;
  const method = user.app_metadata?.provider === "google" ? "google" : "magic";

  // quiz_results' RLS only allows anon_id-header reads, not auth.uid() —
  // signed-in users can't read their own claimed rows directly (a gap
  // outside 2a/2b's scope; see docs/decisions.md). Admin client here for
  // the one-off id this event needs, and for the debate-facing data below.
  let claimedResultId = "";
  let percentile = 0;
  let pendingChallenges: Awaited<ReturnType<typeof getPendingChallenges>> = [];
  let debateHistory: DebateHistoryRow[] = [];

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

    const [percentileValue, pending, history] = await Promise.all([
      getEloPercentile(user.id, elo),
      getPendingChallenges(admin, user.id),
      admin
        .from("debates")
        .select("id, topic_slug, score, rejected, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    percentile = percentileValue;
    pendingChallenges = pending;
    debateHistory = (history.data as DebateHistoryRow[] | null) ?? [];
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <MeViewTracker />
        <WelcomeTracker
          active={welcome === "1"}
          userId={user.id}
          method={method}
          school={school}
          resultId={claimedResultId}
        />
        <p className="eyebrow text-ink-soft mb-4">Me</p>

        {school ? (
          <div
            className="border-l-2 pl-4"
            style={{ borderColor: SCHOOL_COLORS[school].surface }}
          >
            <p className="font-mono text-xs text-ink-soft">Your school</p>
            <h1 className="font-serif text-2xl font-medium mt-1">
              {SCHOOL_COLORS[school].name}
            </h1>
          </div>
        ) : (
          <p className="text-ink-mid text-sm max-w-[50ch]">
            No result attached to your account yet.{" "}
            <Link href="/quiz" className="underline underline-offset-4 text-ink">
              Take the quiz
            </Link>{" "}
            to find your school.
          </p>
        )}

        {school && (
          <div className="mt-8 grid grid-cols-2 gap-6">
            <EloBlock elo={elo} percentile={percentile} />
            <StreakBlock streak={streak} />
          </div>
        )}

        <div className="mt-10 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-4">Pending challenges</p>
          <PendingChallenges challenges={pendingChallenges} />
        </div>

        {debateHistory.length > 0 && (
          <div className="mt-10 border-t border-rule pt-8">
            <p className="eyebrow text-ink-soft mb-4">Debate history</p>
            <ul className="space-y-2">
              {debateHistory.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/debate/${d.topic_slug}/${d.id}`}
                    className="text-ink hover:underline underline-offset-4"
                  >
                    {d.topic_slug}
                  </Link>
                  <span className="font-mono text-xs text-ink-soft">
                    {d.rejected ? "not judged" : d.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-4">Display name</p>
          <DisplayNameForm initial={profile?.display_name ?? null} />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <Link href="/debate" className="font-mono text-xs text-ink-mid hover:text-ink">
            Debate →
          </Link>
        </div>

        <div className="mt-4">
          <Link href="/me/settings" className="font-mono text-xs text-ink-mid hover:text-ink">
            Settings →
          </Link>
        </div>
      </div>
    </main>
  );
}
