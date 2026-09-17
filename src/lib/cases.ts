import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMicroLesson } from "@/lib/micro-lessons";
import { type CaseState } from "@/lib/case-steps";

// Re-exported so the existing server-side importers keep one import path.
// Client components take them from @/lib/case-steps directly.
export { CASE_STEPS, caseTicks } from "@/lib/case-steps";
export type { CaseState } from "@/lib/case-steps";

interface VerdictShape {
  rejected?: boolean;
  unanswered_objection?: unknown;
}

// One round trip per table rather than per topic: callers that need every
// topic at once (TopicList, /me, /class/[code]) go through
// getCaseStates below.
export async function getCaseStates(
  admin: SupabaseClient,
  userId: string,
  topics: { slug: string; microBefore?: string | null }[]
): Promise<Record<string, CaseState>> {
  const slugs = topics.map((t) => t.slug);
  const empty: CaseState = { read: false, argued: false, answered: false, closed: false };
  const states: Record<string, CaseState> = Object.fromEntries(
    slugs.map((slug) => [slug, { ...empty }])
  );
  if (slugs.length === 0) return states;

  const [{ data: responses }, { data: debates }] = await Promise.all([
    admin
      .from("reading_responses")
      .select("topic_slug, chunk_index")
      .eq("user_id", userId)
      .in("topic_slug", slugs),
    admin
      .from("debates")
      .select("id, topic_slug, kind, rejected, verdict")
      .eq("user_id", userId)
      .in("topic_slug", slugs),
  ]);

  const answeredCounts = new Map<string, number>();
  for (const row of responses ?? []) {
    const slug = row.topic_slug as string;
    answeredCounts.set(slug, (answeredCounts.get(slug) ?? 0) + 1);
  }

  for (const topic of topics) {
    const state = states[topic.slug];

    // A lesson with no prompts is read the moment it is shown — there is
    // nothing to answer, so requiring an answer would make those cases
    // permanently unclosable.
    const lesson = topic.microBefore ? getMicroLesson(topic.microBefore) : null;
    const promptCount = lesson?.retrieval_prompts?.length ?? 0;
    state.read = promptCount === 0 || (answeredCounts.get(topic.slug) ?? 0) >= promptCount;
  }

  for (const row of debates ?? []) {
    const state = states[row.topic_slug as string];
    if (!state) continue;
    const verdict = row.verdict as VerdictShape | null;
    const judged = Boolean(verdict) && !row.rejected;
    if (!judged) continue;

    if (row.kind === "revision") {
      // A judged revision is both the answer to the objection and the end
      // of the case; the original it answers is judged by construction.
      state.answered = true;
      state.closed = true;
    } else {
      state.argued = true;
    }
  }

  return states;
}

export async function getCaseState(
  admin: SupabaseClient,
  userId: string,
  topicSlug: string,
  microBefore?: string | null
): Promise<CaseState> {
  const states = await getCaseStates(admin, userId, [{ slug: topicSlug, microBefore }]);
  return states[topicSlug];
}
