import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getMicroLesson } from "@/lib/micro-lessons";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { DebateFlow } from "@/components/debate/DebateFlow";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Debate · Sophecs" };

// Requires auth — the one moment the brief prompts sign-in, per
// docs/decisions.md. Redirects preserve the topic (and challenge id, if
// present) through /login?next= and back.
export default async function DebateTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { slug } = await params;
  const { challenge } = await searchParams;
  const nextPath = `/debate/${slug}${challenge ? `?challenge=${challenge}` : ""}`;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  // One batch, not a waterfall: the judged-debate count is only needed to
  // decide whether to show the first-argument scaffold, and it must not cost
  // this route an extra round trip.
  const [{ data: profile }, { data: topic }, { count: judgedCount }] = await Promise.all([
    admin.from("profiles").select("school").eq("id", user.id).maybeSingle(),
    admin
      .from("debate_topics")
      .select("slug, motion, active, micro_before")
      .eq("slug", slug)
      .maybeSingle(),
    admin
      .from("debates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("verdict", "is", null),
  ]);

  if (!profile?.school) {
    redirect(`/quiz?next=${encodeURIComponent(nextPath)}`);
  }
  if (!topic || !topic.active) notFound();

  const microBefore = getMicroLesson(topic.micro_before);

  // Answers from an earlier visit, so re-entering a lesson shows what was
  // already written instead of asking for it again. Keyed by chunk index,
  // which is what the reading flow and the editor both address them by.
  const readingResponses: Record<number, string> = {};
  if ((microBefore?.retrieval_prompts?.length ?? 0) > 0) {
    const { data: saved } = await admin
      .from("reading_responses")
      .select("chunk_index, response")
      .eq("user_id", user.id)
      .eq("topic_slug", topic.slug);
    for (const row of saved ?? []) {
      readingResponses[Number(row.chunk_index)] = row.response as string;
    }
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <DebateFlow
          topicSlug={topic.slug}
          motion={topic.motion}
          school={profile.school as SchoolId}
          microBefore={microBefore}
          userId={user.id}
          challengeId={challenge}
          isAllowlisted={isJudgeAllowlisted(user.id)}
          isFirstArgument={(judgedCount ?? 0) === 0}
          readingResponses={readingResponses}
        />
      </div>
    </main>
  );
}
