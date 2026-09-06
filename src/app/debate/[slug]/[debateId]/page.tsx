import { notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { Verdict, type VerdictData } from "@/components/debate/Verdict";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Verdict · Sophecs" };

// Public — anyone with the link can view a verdict. Argument text is
// gated separately (owner or argument_public), not the page itself.
export default async function VerdictPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; debateId: string }>;
  searchParams: Promise<{ first?: string }>;
}) {
  const { slug, debateId } = await params;
  const { first } = await searchParams;

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  const { data: publicRow } = await admin
    .from("debates_public")
    .select("id, topic_slug, school, score, verdict, elo_before, elo_after, argument")
    .eq("id", debateId)
    .maybeSingle();
  if (!publicRow || publicRow.topic_slug !== slug) notFound();

  const { data: topic } = await admin
    .from("debate_topics")
    .select("motion, micro_after")
    .eq("slug", slug)
    .maybeSingle();
  if (!topic) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOwner = false;
  let argument: string | null = publicRow.argument;
  let argumentPublic = Boolean(publicRow.argument);

  if (user) {
    // RLS ("debates read own") only returns a row here if this user
    // actually owns it — the sole signal used to decide ownership.
    const { data: ownRow } = await supabase
      .from("debates")
      .select("argument, argument_public")
      .eq("id", debateId)
      .maybeSingle();
    if (ownRow) {
      isOwner = true;
      argument = ownRow.argument;
      argumentPublic = ownRow.argument_public;
    }
  }

  const school = publicRow.school as SchoolId;
  const afterLesson = getMicroLesson(topic.micro_after);
  const verdict = publicRow.verdict as VerdictData;
  const eloDelta =
    publicRow.elo_before != null && publicRow.elo_after != null
      ? Math.round(Number(publicRow.elo_after) - Number(publicRow.elo_before))
      : null;
  const eloAfter = publicRow.elo_after != null ? Number(publicRow.elo_after) : null;

  const schoolContent = getSchool(school);
  const shortMotion = topic.motion.length > 60 ? `${topic.motion.slice(0, 57)}...` : topic.motion;
  const shareLine = schoolContent.verdict_share_line
    .replaceAll("{score}", String(verdict.score ?? ""))
    .replaceAll("{topic}", shortMotion)
    .replaceAll("{verdict_line}", verdict.verdict_line ?? "")
    .replaceAll("{slug}", slug)
    .replaceAll("{id}", debateId);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <Verdict
          debateId={debateId}
          topicSlug={slug}
          motion={topic.motion}
          school={school}
          verdict={verdict}
          eloDelta={eloDelta}
          eloAfter={eloAfter}
          argument={argument}
          isOwner={isOwner}
          argumentPublic={argumentPublic}
          afterLesson={afterLesson}
          showAfterLessonInitially={isOwner && first === "1"}
          shareLine={shareLine}
        />
      </div>
    </main>
  );
}
