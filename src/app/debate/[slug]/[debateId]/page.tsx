import { notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { Verdict, type VerdictData, type RevisionComparison } from "@/components/debate/Verdict";
import { getMicroLesson } from "@/lib/micro-lessons";
import { getRevisionId } from "@/lib/objections";
import { getSchool } from "@/lib/schools";
import { SCHOOL_COLORS } from "@/lib/school-colors";
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
    .select(
      "id, topic_slug, school, score, verdict, elo_before, elo_after, argument, kind, parent_debate_id"
    )
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

  const isRevision = publicRow.kind === "revision";

  // Only an original can have a revision; asking for a revision's revision
  // would always be null, so skip the round trip.
  const revisionId = isRevision ? null : await getRevisionId(admin, debateId);

  // A revision is read against its original. The four marks are already
  // public on the parent's own verdict page, so no extra gating is needed
  // here — the parent's argument text is not read at all.
  let comparison: RevisionComparison | null = null;
  let parentObjectionSchool: SchoolId | null = null;
  if (isRevision && publicRow.parent_debate_id) {
    const { data: parentRow } = await admin
      .from("debates")
      .select("id, verdict")
      .eq("id", publicRow.parent_debate_id)
      .maybeSingle();
    const parentVerdict = (parentRow?.verdict ?? null) as VerdictData | null;
    if (parentRow && parentVerdict && !parentVerdict.rejected) {
      comparison = {
        parentDebateId: parentRow.id as string,
        first: {
          score: parentVerdict.score,
          fidelity: parentVerdict.fidelity,
          rigor: parentVerdict.rigor,
          engagement: parentVerdict.engagement,
        },
      };
      parentObjectionSchool = parentVerdict.unanswered_objection?.school ?? null;
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
  const baseShareLine = schoolContent.verdict_share_line
    .replaceAll("{score}", String(verdict.score ?? ""))
    .replaceAll("{topic}", shortMotion)
    .replaceAll("{verdict_line}", verdict.verdict_line ?? "")
    .replaceAll("{slug}", slug)
    .replaceAll("{id}", debateId);

  // A revision that actually answered its objection gets its own line: the
  // movement is the interesting part, not the absolute score. Built in code
  // rather than as a fourth per-school frontmatter field — it is the same
  // sentence for every school, and one more field to write for each.
  // Anything else (objection still standing, or a v1 parent with no
  // objection at all) falls back to the ordinary verdict line.
  const shareLine =
    comparison && parentObjectionSchool && verdict.objection_answered
      ? `Answered the ${SCHOOL_COLORS[parentObjectionSchool].name} objection to my ` +
        `${SCHOOL_COLORS[school].name} case on ${shortMotion}: ` +
        `${comparison.first.score} → ${verdict.score}. sophecs.com/debate/${slug}/${debateId}`
      : baseShareLine;

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
          hasRevision={revisionId}
          comparison={comparison}
        />
      </div>
    </main>
  );
}
