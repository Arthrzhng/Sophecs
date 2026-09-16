"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickChallengeTopic } from "@/lib/challenge";
import { MAX_RETRIEVAL_RESPONSE_CHARS } from "@/lib/micro-lessons";
import { newId } from "@/lib/ids";

type ActionResult = { ok: true } | { ok: false; error: string };

// debates has no owner-update RLS policy — only insert/select (see
// docs/decisions.md's migration comment: writes to debates are trusted
// server code, same as challenges). So this uses the admin client, with
// ownership verified explicitly via getUser() + .eq("user_id", ...) rather
// than trusting the debateId alone.
export async function setArgumentPublic(debateId: string, value: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("debates")
    .update({ argument_public: value })
    .eq("id", debateId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/debate`);
  return { ok: true };
}

type AssignTopicResult = { ok: true; topicSlug: string } | { ok: false; error: string };

// Called from "Debate them" on /r/[id]. Sets challenges.topic_slug on
// first click so both sides get the same topic — subsequent clicks (by
// either side) just return the already-assigned one.
export async function assignChallengeTopic(challengeId: string): Promise<AssignTopicResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from("challenges")
    .select("topic_slug, challenger_result_id, challengee_result_id")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge) return { ok: false, error: "Challenge not found." };

  if (challenge.topic_slug) {
    return { ok: true, topicSlug: challenge.topic_slug };
  }

  const resultIds = [challenge.challenger_result_id, challenge.challengee_result_id].filter(
    (id): id is string => Boolean(id)
  );
  const { data: results } = await admin.from("quiz_results").select("user_id").in("id", resultIds);
  const participantUserIds = (results ?? [])
    .map((r) => r.user_id as string | null)
    .filter((id): id is string => Boolean(id));

  const topicSlug = await pickChallengeTopic(admin, participantUserIds);
  if (!topicSlug) return { ok: false, error: "No debate topics are live yet." };

  await admin.from("challenges").update({ topic_slug: topicSlug }).eq("id", challengeId);
  return { ok: true, topicSlug };
}

// Upsert on (user_id, topic_slug, chunk_index): re-reading a lesson and
// answering again replaces the note rather than failing on the unique
// index or piling up rows. Uses the user-scoped client, not the admin one —
// reading_responses has real insert/update/select-own RLS policies, so the
// database enforces ownership here rather than application code.
export async function saveReadingResponse(
  topicSlug: string,
  chunkIndex: number,
  response: string
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const text = response.trim();
  if (text.length === 0 || text.length > MAX_RETRIEVAL_RESPONSE_CHARS) {
    return { ok: false, error: "Write between 1 and 300 characters." };
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 1) {
    return { ok: false, error: "Unknown prompt." };
  }

  const { error } = await supabase.from("reading_responses").upsert(
    {
      id: newId(),
      user_id: user.id,
      topic_slug: topicSlug,
      chunk_index: chunkIndex,
      response: text,
    },
    { onConflict: "user_id,topic_slug,chunk_index" }
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
