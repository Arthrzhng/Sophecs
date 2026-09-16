import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getRevisionId } from "@/lib/objections";
import { ArgumentEditor } from "@/components/debate/ArgumentEditor";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Answer the objection · Sophecs" };

interface VerdictShape {
  rejected?: boolean;
  unanswered_objection?: { school: SchoolId; claim: string; why_it_stands: string } | null;
}

// Owner only. A non-owner gets 404 rather than 403 — the existence of
// someone else's unanswered objection is not information this route should
// confirm.
export default async function RevisePage({
  params,
}: {
  params: Promise<{ slug: string; debateId: string }>;
}) {
  const { slug, debateId } = await params;
  const nextPath = `/debate/${slug}/${debateId}/revise`;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  const { data: parent } = await admin
    .from("debates")
    .select("id, user_id, kind, rejected, verdict, argument, school, topic_slug")
    .eq("id", debateId)
    .maybeSingle();

  if (
    !parent ||
    parent.user_id !== user.id ||
    parent.kind !== "original" ||
    parent.rejected ||
    !parent.verdict ||
    parent.topic_slug !== slug
  ) {
    notFound();
  }

  const verdict = parent.verdict as VerdictShape;
  const objection = verdict.unanswered_objection;
  if (!objection) notFound();

  const existingRevision = await getRevisionId(admin, parent.id);

  const { data: topic } = await admin
    .from("debate_topics")
    .select("slug, motion")
    .eq("slug", slug)
    .maybeSingle();
  if (!topic) notFound();

  const school = parent.school as SchoolId;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <p className="eyebrow text-ink-soft mb-4">Answer the objection</p>

        {existingRevision ? (
          <div>
            <p className="font-serif text-xl font-medium">{topic.motion}</p>
            <p className="mt-6 text-ink-mid">
              You&apos;ve already revised this argument. Start a new motion instead.
            </p>
          </div>
        ) : (
          <>
            {/* Pinned, not dismissable: the objection is the brief for this
                screen, and hiding it would leave the editor contextless. */}
            <div className="border-l-2 border-rule pl-4 mb-10">
              <p className={`eyebrow mb-2 ${SCHOOL_TEXT_CLASS[objection.school]}`}>
                Objection · {SCHOOL_COLORS[objection.school].name}
              </p>
              <p className="font-serif text-lg leading-relaxed">{objection.claim}</p>
              <p className="mt-2 font-sans text-sm text-ink-mid leading-relaxed">
                {objection.why_it_stands}
              </p>
            </div>

            <ArgumentEditor
              topicSlug={slug}
              motion={topic.motion}
              school={school}
              userId={user.id}
              isAllowlisted={isJudgeAllowlisted(user.id)}
              mode="revision"
              parentDebateId={parent.id}
              initialArgument={parent.argument ?? ""}
            />
          </>
        )}
      </div>
    </main>
  );
}
