import { notFound } from "next/navigation";
import { SamplePageMarker } from "@/components/sample/SamplePageMarker";
import { sampleMetadata } from "@/lib/sample";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { Verdict, type VerdictData, type RevisionComparison } from "@/components/debate/Verdict";
import { getMicroLesson } from "@/lib/micro-lessons";
import { isoWeekNumber } from "@/lib/weekly-motion";
import { countsOnTable } from "@/lib/school-table";
import { getRevisionId } from "@/lib/objections";
import { getSchool } from "@/lib/schools";
import { Page } from "@/components/layout/Page";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";
import { motionForDebate, shortMotionForShare } from "@/lib/motion-text";
import { shareTemplateFor } from "@/lib/verdict-share";
import { verdictForViewer } from "@/lib/verdict-privacy";

// A sample account's verdict says so in the title too, which is what a
// link preview shows first.
export async function generateMetadata({ params }: { params: Promise<{ debateId: string }> }) {
  const { debateId } = await params;
  if (!isAdminConfigured()) return { title: "Verdict · Sophecs" };
  const { data } = await createAdminClient().from("debates_public").select("is_sample").eq("id", debateId).maybeSingle();
  return data?.is_sample ? sampleMetadata("Sample verdict · Sophecs") : { title: "Verdict · Sophecs" };
}

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
      "id, topic_slug, school, score, verdict, elo_before, elo_after, argument, kind, parent_debate_id, created_at, motion_text, is_sample, verdict_is_template"
    )
    .eq("id", debateId)
    .maybeSingle();
  if (!publicRow || publicRow.topic_slug !== slug) notFound();

  // `motion_text`, the motion as it was worded when the argument was
  // written, comes from `debates_public` with everything else public on
  // this page (migration 0020). It used to need a second admin read of
  // `debates`; see docs/decisions.md, "Phase 3 item: move `motion_text`
  // into `debates_public`".
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
  // debates_public withholds every verdict field that can quote a private
  // argument (migration 0018), so the author reads their own verdict from
  // `debates`, through the same row level security that decides ownership.
  let ownVerdict: unknown = null;

  if (user) {
    // RLS ("debates read own") only returns a row here if this user
    // actually owns it — the sole signal used to decide ownership.
    const { data: ownRow } = await supabase
      .from("debates")
      .select("argument, argument_public, verdict")
      .eq("id", debateId)
      .maybeSingle();
    if (ownRow) {
      isOwner = true;
      argument = ownRow.argument;
      argumentPublic = ownRow.argument_public;
      ownVerdict = ownRow.verdict;
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
  // For a revision, whether its original is public: the revision judge is
  // shown the original, so the revision's verdict can quote it.
  let parentPublic: boolean | null = null;
  if (isRevision && publicRow.parent_debate_id) {
    const { data: parentRow } = await admin
      .from("debates")
      .select("id, verdict, argument_public")
      .eq("id", publicRow.parent_debate_id)
      .maybeSingle();
    parentPublic = Boolean(parentRow?.argument_public);
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

  // Counterpart state, owner only and originals only — a revision can't be
  // paired, and this is the one extra pair of reads this page takes.
  let counterpart: { seeking: boolean; exchangeId: string | null } | null = null;
  if (isOwner && !isRevision) {
    const [{ data: own }, { data: existingExchange }] = await Promise.all([
      admin.from("debates").select("seeking_counterpart_at").eq("id", debateId).maybeSingle(),
      admin
        .from("exchanges")
        .select("id")
        .or(`debate_a.eq.${debateId},debate_b.eq.${debateId}`)
        .limit(1)
        .maybeSingle(),
    ]);
    counterpart = {
      seeking: Boolean(own?.seeking_counterpart_at),
      exchangeId: (existingExchange?.id as string | undefined) ?? null,
    };
  }

  const school = publicRow.school as SchoolId;
  const afterLesson = getMicroLesson(topic.micro_after);
  // The page's one privacy decision, in src/lib/verdict-privacy.ts: the
  // author sees their whole verdict; anyone else sees the judge's words
  // only on a public argument whose original, for a revision, is public
  // too, and otherwise a verdict cut down on the server. Cut here, not in
  // the component: Verdict is a client component, and whatever it is
  // handed lands in the page payload whether it is shown or not.
  const view = verdictForViewer({
    isOwner,
    ownVerdict,
    publicVerdict: publicRow.verdict,
    publicArgument: publicRow.argument as string | null,
    parentPublic,
  });
  const textWithheld = view.textWithheld;
  // Non-null as before: an unjudged row reaching this page behaves exactly
  // as it does on main.
  const verdict = view.verdict as VerdictData;
  const eloDelta =
    publicRow.elo_before != null && publicRow.elo_after != null
      ? Math.round(Number(publicRow.elo_after) - Number(publicRow.elo_before))
      : null;

  // Only the owner sees a streak, and only the owner has one to see. One
  // extra read, guarded, rather than widening the public row.
  let streak: number | null = null;
  if (isOwner && user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("streak")
      .eq("id", user.id)
      .maybeSingle();
    streak = profile ? Number(profile.streak ?? 0) : null;
  }

  // The week the argument was written in, not the week it is being read
  // in: a verdict opened a fortnight later still belongs to its own week.
  const weekNumber = publicRow.created_at
    ? isoWeekNumber(new Date(publicRow.created_at as string))
    : null;

  const schoolContent = getSchool(school);
  // The wording this argument was actually argued against, not the wording
  // the motion carries now. The two differ for any debate submitted before
  // a reword, and this page is the one that used to say the wrong thing.
  const motion = motionForDebate(publicRow.motion_text as string | null, topic.motion);
  const shortMotion = shortMotionForShare(motion);
  const shareTemplate = shareTemplateFor(schoolContent.verdict_share_line, textWithheld);
  const baseShareLine = shareTemplate
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
    <Page width="ui">
      {publicRow.is_sample && <SamplePageMarker />}
      <Verdict
        debateId={debateId}
        topicSlug={slug}
        motion={motion}
        school={school}
        verdict={verdict}
        eloDelta={eloDelta}
        eloAfter={publicRow.elo_after == null ? null : Math.round(Number(publicRow.elo_after))}
        streak={streak}
        weekNumber={weekNumber}
        // One, where this argument actually moved its school's row:
        // original, judged, and inside the week the table is showing. A
        // revision, a rejected argument and an older week each get no
        // line rather than a number the table will not corroborate.
        tableContribution={countsOnTable({
          kind: publicRow.kind as string | null,
          rejected: verdict.rejected,
          createdAt: publicRow.created_at as string | null,
        })
          ? 1
          : null}
        argument={argument}
        isOwner={isOwner}
        argumentPublic={argumentPublic}
        afterLesson={afterLesson}
        showAfterLessonInitially={isOwner && first === "1"}
        shareLine={shareLine}
        hasRevision={revisionId}
        comparison={comparison}
        counterpart={counterpart}
        textWithheld={textWithheld}
        // A sample account's argument (migration 0022): labelled, and a
        // template verdict says it is one.
        sample={
          publicRow.is_sample
            ? { template: Boolean(publicRow.verdict_is_template) }
            : null
        }
      />
    </Page>
  );
}
