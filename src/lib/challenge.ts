import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pairwiseElo } from "@/lib/elo";
import type { SchoolId } from "@/lib/types";

// The active topic with the lowest sort that neither known participant has
// debated in the last seven days, per the brief. Participants who haven't
// signed in yet have no debate history to exclude on, so this degrades
// gracefully to "lowest-sort active topic" until both sides are claimed.
export async function pickChallengeTopic(
  admin: SupabaseClient,
  participantUserIds: string[]
): Promise<string | null> {
  const { data: topics } = await admin
    .from("debate_topics")
    .select("slug")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (!topics || topics.length === 0) return null;

  const sinceLock = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ids = participantUserIds.filter(Boolean);

  for (const topic of topics) {
    if (ids.length === 0) return topic.slug;
    const { count } = await admin
      .from("debates")
      .select("id", { count: "exact", head: true })
      .eq("topic_slug", topic.slug)
      .in("user_id", ids)
      .gte("created_at", sinceLock);
    if (!count) return topic.slug;
  }
  // Every active topic was recently debated by a participant — fall back
  // to the lowest-sort one rather than blocking the challenge entirely.
  return topics[0].slug;
}

export type ChallengeSide = "challenger" | "challengee";

export async function resolveChallengeSide(
  admin: SupabaseClient,
  challenge: { challenger_result_id: string; challengee_result_id: string | null },
  userId: string
): Promise<ChallengeSide | null> {
  const { data: challengerResult } = await admin
    .from("quiz_results")
    .select("user_id")
    .eq("id", challenge.challenger_result_id)
    .maybeSingle();
  if (challengerResult?.user_id === userId) return "challenger";

  if (challenge.challengee_result_id) {
    const { data: challengeeResult } = await admin
      .from("quiz_results")
      .select("user_id")
      .eq("id", challenge.challengee_result_id)
      .maybeSingle();
    if (challengeeResult?.user_id === userId) return "challengee";
  }
  return null;
}

export interface PendingChallenge {
  challengeId: string;
  topicSlug: string | null;
  otherSchool: SchoolId | null;
}

// /me's pending-challenges list: challenges touching one of this user's
// claimed quiz_results where their own side hasn't submitted a debate yet.
// Covers the brief's retroactive case too — a Phase 1 challenge row a
// user's claimed result is party to shows up here the same way a brand
// new one does, no separate backfill needed.
export async function getPendingChallenges(
  admin: SupabaseClient,
  userId: string
): Promise<PendingChallenge[]> {
  const { data: ownResults } = await admin.from("quiz_results").select("id").eq("user_id", userId);
  const ownResultIds = (ownResults ?? []).map((r) => r.id as string);
  if (ownResultIds.length === 0) return [];

  const orFilter = ownResultIds
    .map((id) => `challenger_result_id.eq.${id},challengee_result_id.eq.${id}`)
    .join(",");
  const { data: challenges } = await admin
    .from("challenges")
    .select(
      "id, topic_slug, status, challenger_result_id, challengee_result_id, challenger_debate_id, challengee_debate_id"
    )
    .or(orFilter)
    .neq("status", "complete");

  const pending: PendingChallenge[] = [];
  for (const c of challenges ?? []) {
    const isChallenger = ownResultIds.includes(c.challenger_result_id);
    const myDebateId = isChallenger ? c.challenger_debate_id : c.challengee_debate_id;
    if (myDebateId) continue; // this side already submitted

    const otherResultId = isChallenger ? c.challengee_result_id : c.challenger_result_id;
    let otherSchool: SchoolId | null = null;
    if (otherResultId) {
      const { data: otherResult } = await admin
        .from("quiz_results")
        .select("school")
        .eq("id", otherResultId)
        .maybeSingle();
      otherSchool = (otherResult?.school as SchoolId | undefined) ?? null;
    }
    pending.push({ challengeId: c.id, topicSlug: c.topic_slug, otherSchool });
  }
  return pending;
}

export interface ChallengeCompletionResult {
  completed: boolean;
  winnerSchool?: SchoolId | "draw";
}

// Called after a judged (non-rejected) debate whose row has challenge_id
// set. Records this side's debate on the challenges row; once both sides
// have a debate, recomputes both debates' ELO with the pairwise rule
// (overwriting elo_after only — elo_before stays each side's real
// pre-debate rating) and marks the challenge complete.
export async function recordChallengeDebate(
  admin: SupabaseClient,
  challengeId: string,
  side: ChallengeSide,
  debateId: string
): Promise<ChallengeCompletionResult> {
  const column = side === "challenger" ? "challenger_debate_id" : "challengee_debate_id";
  await admin.from("challenges").update({ [column]: debateId }).eq("id", challengeId);

  const { data: challenge } = await admin
    .from("challenges")
    .select("challenger_debate_id, challengee_debate_id")
    .eq("id", challengeId)
    .maybeSingle();

  if (!challenge?.challenger_debate_id || !challenge?.challengee_debate_id) {
    return { completed: false };
  }

  const [{ data: challengerDebate }, { data: challengeeDebate }] = await Promise.all([
    admin
      .from("debates")
      .select("id, user_id, school, score, elo_before")
      .eq("id", challenge.challenger_debate_id)
      .maybeSingle(),
    admin
      .from("debates")
      .select("id, user_id, school, score, elo_before")
      .eq("id", challenge.challengee_debate_id)
      .maybeSingle(),
  ]);
  if (!challengerDebate || !challengeeDebate) return { completed: false };

  const now = new Date().toISOString();
  const challengerResult = pairwiseElo(
    Number(challengerDebate.elo_before),
    Number(challengeeDebate.elo_before),
    Number(challengerDebate.score),
    Number(challengeeDebate.score)
  );
  const challengeeResult = pairwiseElo(
    Number(challengeeDebate.elo_before),
    Number(challengerDebate.elo_before),
    Number(challengeeDebate.score),
    Number(challengerDebate.score)
  );

  await Promise.all([
    admin
      .from("debates")
      .update({ elo_after: challengerResult.eloAfter, elo_recomputed_at: now })
      .eq("id", challengerDebate.id),
    admin
      .from("debates")
      .update({ elo_after: challengeeResult.eloAfter, elo_recomputed_at: now })
      .eq("id", challengeeDebate.id),
    admin.from("profiles").update({ elo: challengerResult.eloAfter }).eq("id", challengerDebate.user_id),
    admin.from("profiles").update({ elo: challengeeResult.eloAfter }).eq("id", challengeeDebate.user_id),
    admin.from("challenges").update({ status: "complete" }).eq("id", challengeId),
  ]);

  const scoreDiff = Number(challengerDebate.score) - Number(challengeeDebate.score);
  const winnerSchool: SchoolId | "draw" =
    Math.abs(scoreDiff) <= 3
      ? "draw"
      : scoreDiff > 0
        ? (challengerDebate.school as SchoolId)
        : (challengeeDebate.school as SchoolId);

  return { completed: true, winnerSchool };
}
