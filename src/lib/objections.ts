import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolId } from "@/lib/types";

export interface OpenObjection {
  debateId: string;
  topicSlug: string;
  topicTitle: string;
  school: SchoolId;
  rivalSchool: SchoolId;
  claim: string;
  createdAt: string;
}

interface VerdictShape {
  rejected?: boolean;
  unanswered_objection?: { school: SchoolId; claim: string; why_it_stands: string } | null;
}

// An objection is open when the original is judged and not rejected, names
// an objection, and has no revision yet. Computed rather than stored: a
// denormalised status column would need updating from three places (judge,
// revision, deletion) and would be wrong the moment one of them changed.
//
// Verdicts written under prompt v1 carry no `unanswered_objection`, so they
// simply never become open objections — no backfill needed.
export async function getOpenObjections(
  admin: SupabaseClient,
  userId: string
): Promise<OpenObjection[]> {
  const { data: originals } = await admin
    .from("debates")
    .select("id, topic_slug, school, verdict, created_at")
    .eq("user_id", userId)
    .eq("kind", "original")
    .not("verdict", "is", null)
    .order("created_at", { ascending: true });

  const rows = originals ?? [];
  if (rows.length === 0) return [];

  // One round trip for every child rather than one per parent.
  const { data: children } = await admin
    .from("debates")
    .select("parent_debate_id")
    .eq("user_id", userId)
    .eq("kind", "revision")
    .in(
      "parent_debate_id",
      rows.map((r) => r.id)
    );
  const answered = new Set((children ?? []).map((c) => c.parent_debate_id as string));

  const withObjections = rows.filter((row) => {
    if (answered.has(row.id)) return false;
    const verdict = row.verdict as VerdictShape | null;
    return Boolean(verdict && !verdict.rejected && verdict.unanswered_objection);
  });
  if (withObjections.length === 0) return [];

  const { data: topics } = await admin
    .from("debate_topics")
    .select("slug, title")
    .in(
      "slug",
      withObjections.map((r) => r.topic_slug as string)
    );
  const titleBySlug = new Map((topics ?? []).map((t) => [t.slug as string, t.title as string]));

  return withObjections.map((row) => {
    const objection = (row.verdict as VerdictShape).unanswered_objection!;
    return {
      debateId: row.id as string,
      topicSlug: row.topic_slug as string,
      topicTitle: titleBySlug.get(row.topic_slug as string) ?? (row.topic_slug as string),
      school: row.school as SchoolId,
      rivalSchool: objection.school,
      claim: objection.claim,
      createdAt: row.created_at as string,
    };
  });
}

// The revision for an original, if one exists. Used by the verdict page to
// swap "Answer it" for "Answered — read the revision".
export async function getRevisionId(
  admin: SupabaseClient,
  parentDebateId: string
): Promise<string | null> {
  const { data } = await admin
    .from("debates")
    .select("id")
    .eq("parent_debate_id", parentDebateId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
