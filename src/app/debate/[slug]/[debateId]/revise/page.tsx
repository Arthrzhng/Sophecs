import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getRevisionId } from "@/lib/objections";
import { ArgumentEditor } from "@/components/debate/ArgumentEditor";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { Page } from "@/components/layout/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
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
    <Page width="read">
      {existingRevision ? (
        <div>
          <p className="text-sm text-ink-soft">Answer the objection</p>
          <h1 className="mt-1 max-w-[60ch] font-serif text-lg font-medium leading-snug text-ink">
            {topic.motion}
          </h1>
          <div className="mt-8">
            <EmptyState
              title="You have already revised this argument."
              body="One revision per argument, so this one is closed. The objection the judge left standing is worth carrying into a new motion rather than rewriting this one."
              action={
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <TextLink href={`/debate/${slug}/${parent.id}`}>Read the verdict</TextLink>
                  <TextLink href="/debate">Take another motion</TextLink>
                </div>
              }
            />
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Answer the objection</p>
          {/* Pinned, not dismissable: the objection is the brief for this
              screen, and hiding it would leave the editor contextless. */}
          <div
            className="mt-4 mb-10 max-w-[60ch] border-l-2 pl-4"
            style={{ borderColor: SCHOOL_COLORS[objection.school].surface }}
          >
            <p className="text-sm text-ink-mid">{SCHOOL_COLORS[objection.school].name}</p>
            <p className="mt-2 font-serif text-md leading-relaxed text-ink">{objection.claim}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-mid">{objection.why_it_stands}</p>
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
    </Page>
  );
}
