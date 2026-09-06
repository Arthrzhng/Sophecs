import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { TopicList, type TopicListItem } from "@/components/debate/TopicList";
import { DebateListViewTracker } from "@/components/debate/DebateListViewTracker";
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
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("debate_topics")
      .select("slug, title, motion, stances, par_elo")
      .eq("active", true)
      .order("sort", { ascending: true });

    topics = await Promise.all(
      (rows ?? []).map(async (row) => {
        let bestScore: number | null = null;
        if (user) {
          const { data: best } = await admin
            .from("debates")
            .select("score")
            .eq("user_id", user.id)
            .eq("topic_slug", row.slug)
            .not("score", "is", null)
            .order("score", { ascending: false })
            .limit(1)
            .maybeSingle();
          bestScore = best?.score != null ? Number(best.score) : null;
        }
        return {
          slug: row.slug,
          title: row.title,
          motion: row.motion,
          stances: row.stances as Record<SchoolId, string>,
          parElo: Number(row.par_elo),
          bestScore,
        };
      })
    );
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <DebateListViewTracker />
        <p className="eyebrow text-ink-soft mb-4">Debate</p>
        <TopicList topics={topics} school={school} />
      </div>
    </main>
  );
}
