import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { TopicList, type TopicListItem } from "@/components/debate/TopicList";
import { DebateListViewTracker } from "@/components/debate/DebateListViewTracker";
import { getWeeklyMotion } from "@/lib/weekly-motion";
import { getCaseStates, type CaseState } from "@/lib/cases";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Debate · Sophecs" };

// Reads debate_topics directly — empty until Arthur's content is seeded via
// scripts/seed-topics.ts, so this needs no separate "still developing"
// stub to keep in sync; TopicList renders the same message from real data.
export default async function DebatePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let school: SchoolId | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("school")
      .eq("id", user.id)
      .maybeSingle();
    school = (profile?.school as SchoolId) ?? null;
  }

  let topics: TopicListItem[] = [];
  let weeklySlug: string | null = null;
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("debate_topics")
      .select("slug, title, motion, stances, par_elo, sort, micro_before")
      .eq("active", true)
      .order("sort", { ascending: true });

    weeklySlug =
      getWeeklyMotion(
        (rows ?? []).map((r) => ({
          slug: r.slug as string,
          title: r.title as string,
          sort: Number(r.sort),
        }))
      )?.slug ?? null;

    // Best score per topic in one query rather than one per topic: this was
    // six round trips on a six-motion list, and adding case states would
    // have made it twelve.
    const bestByTopic = new Map<string, number>();
    let caseStates: Record<string, CaseState> = {};
    if (user) {
      const [{ data: scored }, states] = await Promise.all([
        admin
          .from("debates")
          .select("topic_slug, score")
          .eq("user_id", user.id)
          .not("score", "is", null),
        getCaseStates(
          admin,
          user.id,
          (rows ?? []).map((r) => ({
            slug: r.slug as string,
            microBefore: r.micro_before as string | null,
          }))
        ),
      ]);
      for (const row of scored ?? []) {
        const slug = row.topic_slug as string;
        const score = Number(row.score);
        if (score > (bestByTopic.get(slug) ?? -Infinity)) bestByTopic.set(slug, score);
      }
      caseStates = states;
    }

    topics = (rows ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      motion: row.motion,
      stances: row.stances as Record<SchoolId, string>,
      parElo: Number(row.par_elo),
      bestScore: bestByTopic.get(row.slug) ?? null,
      caseState: caseStates[row.slug],
    }));
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <DebateListViewTracker />
        <p className="eyebrow text-ink-soft mb-4">Debate</p>
        <TopicList topics={topics} school={school} weeklySlug={weeklySlug} />
      </div>
    </main>
  );
}
