import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getMicroLesson } from "@/lib/micro-lessons";
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

  const { data: profile } = await admin
    .from("profiles")
    .select("school")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.school) {
    redirect(`/quiz?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: topic } = await admin
    .from("debate_topics")
    .select("slug, motion, active, micro_before")
    .eq("slug", slug)
    .maybeSingle();
  if (!topic || !topic.active) notFound();

  const microBefore = getMicroLesson(topic.micro_before);

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
        />
      </div>
    </main>
  );
}
