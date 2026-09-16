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

// --- Counterpart ---

// Opt-in and pairing in one action. There is no queue and no cron: opting
// in marks the debate, then immediately looks for someone already waiting
// on the same motion. Whoever arrives second completes the pair, so the
// only thing a "queue" would buy is a number to display, which the brief
// explicitly rules out.
export async function seekCounterpart(
  debateId: string
): Promise<{ ok: true; exchangeId: string | null } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();

  const { data: mine } = await admin
    .from("debates")
    .select("id, user_id, topic_slug, school, kind, rejected, verdict, seeking_counterpart_at")
    .eq("id", debateId)
    .maybeSingle();
  if (
    !mine ||
    mine.user_id !== user.id ||
    mine.kind !== "original" ||
    mine.rejected ||
    !mine.verdict
  ) {
    return { ok: false, error: "Unknown debate." };
  }

  // Already in an exchange for this debate — opting in again must not
  // create a second one.
  const { data: existing } = await admin
    .from("exchanges")
    .select("id")
    .or(`debate_a.eq.${mine.id},debate_b.eq.${mine.id}`)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, exchangeId: existing.id as string };

  if (!mine.seeking_counterpart_at) {
    await admin
      .from("debates")
      .update({ seeking_counterpart_at: new Date().toISOString() })
      .eq("id", mine.id);
  }

  // Everyone else waiting on this motion, oldest first. Blocks and prior
  // pairings are filtered in code rather than SQL because they need two
  // more round trips either way and this list is short by construction —
  // it is only people who opted in and have not yet been paired.
  const { data: candidates } = await admin
    .from("debates")
    .select("id, user_id, school, seeking_counterpart_at")
    .eq("topic_slug", mine.topic_slug)
    .eq("kind", "original")
    .eq("rejected", false)
    .not("seeking_counterpart_at", "is", null)
    .neq("user_id", user.id)
    .order("seeking_counterpart_at", { ascending: true })
    .limit(20);

  const pool = (candidates ?? []).filter((c) => c.school !== mine.school && c.user_id);
  if (pool.length === 0) return { ok: true, exchangeId: null };

  const [{ data: blockRows }, { data: openRows }] = await Promise.all([
    admin
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    admin
      .from("exchanges")
      .select("user_a, user_b")
      .eq("status", "open")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
  ]);

  // A block in either direction disqualifies, permanently.
  const blocked = new Set<string>();
  for (const row of blockRows ?? []) {
    if (row.blocker_id === user.id) blocked.add(row.blocked_id as string);
    if (row.blocked_id === user.id) blocked.add(row.blocker_id as string);
  }
  // An exchange already running with the same person disqualifies too —
  // two live exchanges between one pair would just be one exchange with
  // eight turns, which is the thing the four-turn cap exists to prevent.
  // A *finished* exchange does not: with six motions and a school-sized
  // cohort, refusing to ever re-pair would starve pairing entirely.
  const midExchange = new Set<string>();
  for (const row of openRows ?? []) {
    midExchange.add(row.user_a === user.id ? (row.user_b as string) : (row.user_a as string));
  }

  const match = pool.find((c) => {
    const id = c.user_id as string;
    return !blocked.has(id) && !midExchange.has(id);
  });
  if (!match) return { ok: true, exchangeId: null };

  const exchangeId = newId();
  // The waiting seeker opens. They have been holding a turn-shaped gap for
  // longer, and the newer arrival has just re-read their own argument, so
  // giving the opener's slot to whoever waited keeps the first reply the
  // freshest one. `next_turn` is the newer seeker, per the brief.
  const { error: insertError } = await admin.from("exchanges").insert({
    id: exchangeId,
    topic_slug: mine.topic_slug,
    debate_a: match.id,
    debate_b: mine.id,
    user_a: match.user_id,
    user_b: user.id,
    school_a: match.school,
    school_b: mine.school,
    next_turn: user.id,
  });
  if (insertError) return { ok: false, error: insertError.message };

  await admin
    .from("debates")
    .update({ seeking_counterpart_at: null })
    .in("id", [mine.id, match.id as string]);

  return { ok: true, exchangeId };
}

export async function blockCounterpart(exchangeId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: exchange } = await admin
    .from("exchanges")
    .select("id, user_a, user_b")
    .eq("id", exchangeId)
    .maybeSingle();
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) {
    return { ok: false, error: "Unknown exchange." };
  }

  const other = exchange.user_a === user.id ? exchange.user_b : exchange.user_a;
  if (other) {
    await admin
      .from("blocks")
      .upsert({ blocker_id: user.id, blocked_id: other }, { onConflict: "blocker_id,blocked_id" });
  }
  await admin
    .from("exchanges")
    .update({ status: "blocked", next_turn: null })
    .eq("id", exchangeId);

  revalidatePath(`/counterpart/${exchangeId}`);
  return { ok: true };
}

export async function reportTurn(
  turnId: string,
  reason: "harassment" | "personal_info" | "off_topic" | "spam" | "other",
  note: string
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (note.length > 300) return { ok: false, error: "Keep the note under 300 characters." };

  // RLS on reports only checks that the reporter is the caller, so
  // membership of the exchange is verified here.
  const admin = createAdminClient();
  const { data: turn } = await admin
    .from("turns")
    .select("id, exchange_id")
    .eq("id", turnId)
    .maybeSingle();
  if (!turn) return { ok: false, error: "Unknown reply." };

  const { data: exchange } = await admin
    .from("exchanges")
    .select("user_a, user_b")
    .eq("id", turn.exchange_id)
    .maybeSingle();
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) {
    return { ok: false, error: "Unknown reply." };
  }

  const { error } = await admin.from("reports").insert({
    id: newId(),
    turn_id: turnId,
    reporter_id: user.id,
    reason,
    note: note.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Both parties must opt in; the view does the AND, this just sets one side.
export async function setExchangePublish(
  exchangeId: string,
  value: boolean
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: exchange } = await admin
    .from("exchanges")
    .select("id, user_a, user_b, status")
    .eq("id", exchangeId)
    .maybeSingle();
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) {
    return { ok: false, error: "Unknown exchange." };
  }
  if (exchange.status !== "complete") {
    return { ok: false, error: "This exchange hasn't finished yet." };
  }

  const column = exchange.user_a === user.id ? "publish_a" : "publish_b";
  const { error } = await admin
    .from("exchanges")
    .update({ [column]: value })
    .eq("id", exchangeId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/counterpart/${exchangeId}`);
  return { ok: true };
}
