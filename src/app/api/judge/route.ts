import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import { judgeDebate, JudgeValidationError, PROMPT_VERSION } from "@/lib/anthropic";
import { isBudgetExceeded } from "@/lib/budget";
import { soloElo } from "@/lib/elo";
import { MIN_ARGUMENT_WORDS, MAX_ARGUMENT_WORDS, wordCount } from "@/lib/debate-limits";
import type { SchoolId } from "@/lib/types";

const DAILY_CAP = 5;
const TOPIC_LOCK_DAYS = 7;
const PAR_ELO_WINDOW = 50;

type PauseReason = "kill_switch" | "budget" | "daily_cap" | "topic_lock";

function paused(reason: PauseReason) {
  return NextResponse.json({ ok: false, paused: true, reason });
}

// Order follows the brief exactly: session, kill switch, budget, daily cap,
// topic lock, length, insert, call the model, validate, elo, return. The
// only two deviations are unavoidable data lookups (profile/topic) needed
// to perform the checks after them, interleaved rather than done upfront.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { topicSlug?: string; argument?: string; challengeId?: string }
    | null;

  if (!body?.topicSlug || typeof body.argument !== "string") {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  if (process.env.KILL_SWITCH_JUDGE === "true") {
    return paused("kill_switch");
  }
  if (await isBudgetExceeded()) {
    return paused("budget");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("school, elo")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.school) {
    return NextResponse.json({ ok: false, error: "Take the quiz first." }, { status: 400 });
  }

  const { data: topic } = await admin
    .from("debate_topics")
    .select("slug, motion, active, par_elo")
    .eq("slug", body.topicSlug)
    .maybeSingle();
  if (!topic || !topic.active) {
    return NextResponse.json({ ok: false, error: "Unknown topic." }, { status: 404 });
  }

  const sinceDaily = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await admin
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "judge")
    .gte("created_at", sinceDaily);
  if ((dailyCount ?? 0) >= DAILY_CAP) {
    return paused("daily_cap");
  }

  const sinceLock = new Date(Date.now() - TOPIC_LOCK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("debates")
    .select("id, verdict, argument")
    .eq("user_id", user.id)
    .eq("topic_slug", topic.slug)
    .gte("created_at", sinceLock)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A judged row within the lock window blocks a new attempt. An
  // unjudged row (a previous call errored before producing a verdict)
  // doesn't — it's reused below instead of counting as a second attempt.
  if (recent?.verdict) {
    return paused("topic_lock");
  }

  const words = wordCount(body.argument);
  if (words < MIN_ARGUMENT_WORDS || words > MAX_ARGUMENT_WORDS) {
    return NextResponse.json(
      { ok: false, error: `Argument must be ${MIN_ARGUMENT_WORDS}-${MAX_ARGUMENT_WORDS} words (got ${words}).` },
      { status: 400 }
    );
  }

  const debateId = recent?.id ?? newId();
  const school = profile.school as SchoolId;

  if (!recent) {
    await admin.from("debates").insert({
      id: debateId,
      user_id: user.id,
      topic_slug: topic.slug,
      challenge_id: body.challengeId ?? null,
      school,
      argument: body.argument,
    });
  } else if (recent.argument !== body.argument) {
    await admin.from("debates").update({ argument: body.argument }).eq("id", debateId);
  }

  let judged;
  try {
    judged = await judgeDebate({
      motion: topic.motion,
      school,
      argument: body.argument,
      userId: user.id,
      debateId,
    });
  } catch (err) {
    const detail = err instanceof JudgeValidationError ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.error("[judge] model call failed:", detail);
    }
    return NextResponse.json(
      { ok: false, error: "Judging failed. Your argument is saved. Try again." },
      { status: 502 }
    );
  }

  const { verdict } = judged;

  if (verdict.rejected) {
    await admin
      .from("debates")
      .update({
        rejected: true,
        rejection_reason: verdict.rejection_reason,
        verdict: { ...verdict, prompt_version: PROMPT_VERSION },
        prompt_version: PROMPT_VERSION,
      })
      .eq("id", debateId);
    return NextResponse.json({ ok: true, debateId });
  }

  const eloBefore = Number(profile.elo ?? 1200);
  const { eloAfter } = soloElo(eloBefore, Number(topic.par_elo), verdict.score);

  await admin
    .from("debates")
    .update({
      verdict: { ...verdict, prompt_version: PROMPT_VERSION },
      score: verdict.score,
      prompt_version: PROMPT_VERSION,
      elo_before: eloBefore,
      elo_after: eloAfter,
    })
    .eq("id", debateId);

  await admin.from("profiles").update({ elo: eloAfter }).eq("id", user.id);

  // par_elo is the true rolling mean of the last 50 participants'
  // elo_before, recomputed directly rather than maintained incrementally —
  // one indexed query, exact, no drift.
  const { data: recentElos } = await admin
    .from("debates")
    .select("elo_before")
    .eq("topic_slug", topic.slug)
    .not("elo_before", "is", null)
    .order("created_at", { ascending: false })
    .limit(PAR_ELO_WINDOW);
  const values = (recentElos ?? []).map((r) => Number(r.elo_before));
  if (values.length > 0) {
    const newParElo = values.reduce((sum, v) => sum + v, 0) / values.length;
    await admin
      .from("debate_topics")
      .update({ par_elo: newParElo, par_n: values.length })
      .eq("slug", topic.slug);
  }

  return NextResponse.json({ ok: true, debateId });
}
