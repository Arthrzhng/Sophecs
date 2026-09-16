import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import { judgeDebate, JudgeValidationError, PROMPT_VERSION } from "@/lib/anthropic";
import { isBudgetExceeded } from "@/lib/budget";
import { soloElo } from "@/lib/elo";
import { applyStreakDay, isStreakEligible } from "@/lib/streak";
import { recordChallengeDebate, resolveChallengeSide } from "@/lib/challenge";
import { isJudgeAllowlisted } from "@/lib/judge-allowlist";
import { MIN_ARGUMENT_WORDS, MAX_ARGUMENT_WORDS, wordCount } from "@/lib/debate-limits";
import type { SchoolId } from "@/lib/types";

const DAILY_CAP = 5;
const TOPIC_LOCK_DAYS = 7;
const PAR_ELO_WINDOW = 50;

type PauseReason = "kill_switch" | "budget" | "daily_cap" | "topic_lock" | "already_revised";

function paused(reason: PauseReason) {
  return NextResponse.json({ ok: false, paused: true, reason });
}

// Order follows the brief exactly: session, kill switch, budget, daily cap,
// topic lock, length, insert, call the model, validate, elo, return. The
// only two deviations are unavoidable data lookups (profile/topic) needed
// to perform the checks after them, interleaved rather than done upfront.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { topicSlug?: string; argument?: string; challengeId?: string; parentDebateId?: string }
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

  // Allowlisted reviewers (JUDGE_ALLOWLIST_USER_IDS) bypass the kill switch
  // and the daily cap only — budget, length, and the topic lock still
  // apply. Checked here, right after the session check and before the
  // kill switch, per how this was asked for.
  const isAllowlisted = isJudgeAllowlisted(user.id);
  const isRevision = typeof body.parentDebateId === "string" && body.parentDebateId.length > 0;

  if (!isAllowlisted && process.env.KILL_SWITCH_JUDGE === "true") {
    return paused("kill_switch");
  }
  if (await isBudgetExceeded()) {
    return paused("budget");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("school, elo, streak, streak_updated_on")
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

  if (!isAllowlisted) {
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
  }

  // A revision skips the seven-day topic lock entirely — it is the second
  // half of one attempt, not a new one — and never reuses an existing row.
  let parent: {
    id: string;
    verdict: unknown;
    elo_after: number | null;
    argument: string | null;
    created_at: string | null;
  } | null = null;
  if (isRevision) {
    const { data: parentRow } = await admin
      .from("debates")
      .select("id, user_id, kind, rejected, verdict, elo_after, topic_slug, argument, created_at")
      .eq("id", body.parentDebateId!)
      .maybeSingle();

    if (
      !parentRow ||
      parentRow.user_id !== user.id ||
      parentRow.kind !== "original" ||
      parentRow.rejected ||
      !parentRow.verdict ||
      parentRow.topic_slug !== topic.slug
    ) {
      return NextResponse.json({ ok: false, error: "Unknown debate." }, { status: 404 });
    }

    const { data: existingChild } = await admin
      .from("debates")
      .select("id")
      .eq("parent_debate_id", parentRow.id)
      .maybeSingle();
    if (existingChild) return paused("already_revised");

    parent = {
      id: parentRow.id,
      verdict: parentRow.verdict,
      elo_after: parentRow.elo_after as number | null,
      argument: (parentRow.argument as string | null) ?? null,
      created_at: (parentRow.created_at as string | null) ?? null,
    };
  }

  const sinceLock = new Date(Date.now() - TOPIC_LOCK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = isRevision
    ? { data: null }
    : await admin
        .from("debates")
        .select("id, verdict, argument")
        // Only originals hold the lock. Without this filter a revision
        // would lock its own topic for seven days the moment it landed.
        .eq("kind", "original")
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
    // `recent` is always null on a revision, so this always inserts a fresh
    // row there — never the reuse path below, which would otherwise let a
    // revision overwrite an abandoned unjudged original that happened to
    // share the topic.
    const { error: insertError } = await admin.from("debates").insert({
      id: debateId,
      user_id: user.id,
      topic_slug: topic.slug,
      challenge_id: isRevision ? null : body.challengeId ?? null,
      school,
      argument: body.argument,
      kind: isRevision ? "revision" : "original",
      parent_debate_id: isRevision ? parent!.id : null,
    });
    // The unique index is the real guard against a double-submit: two
    // concurrent revisions both pass the existence check above, and the
    // loser lands here.
    if (insertError) {
      return paused("already_revised");
    }
  } else if (recent.argument !== body.argument) {
    await admin.from("debates").update({ argument: body.argument }).eq("id", debateId);
  }

  // The model is shown the original and the objection it is meant to answer,
  // so it can judge whether the objection was actually engaged.
  const parentVerdict = parent?.verdict as
    | {
        unanswered_objection?: { claim: string } | null;
        score?: number | null;
        fidelity?: number | null;
      }
    | undefined;
  const revisionContext =
    isRevision && parentVerdict?.unanswered_objection
      ? {
          originalArgument: (parent?.argument ?? "").trim(),
          objectionClaim: parentVerdict.unanswered_objection.claim,
        }
      : null;

  let judged;
  try {
    judged = await judgeDebate({
      motion: topic.motion,
      school,
      argument: body.argument,
      userId: user.id,
      debateId,
      kind: isAllowlisted ? "judge_allowlist" : "judge",
      revisionOf: revisionContext ?? undefined,
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

  // The objection has to come from a rival school: zod can see the shape but
  // not the school this argument was assigned, so the check lives here.
  // Measured at roughly one sample in three on the deliberately
  // wrong-school golden fixtures, and near zero on arguments that actually
  // reason from their assigned school. Dropping the objection is better
  // than discarding the judgement: the user keeps their score, the three
  // criteria and every written note, and simply gets no objection to
  // revise against — which is the right outcome anyway for an argument
  // whose real problem is that it never argued its own school.
  let storedVerdict: typeof verdict = verdict;
  if (verdict.unanswered_objection.school === school) {
    console.warn(
      `[judge] objection drawn from the argued school (${school}) on debate ${debateId}; dropping it`
    );
    const { unanswered_objection: _dropped, ...rest } = verdict;
    storedVerdict = rest as typeof verdict;
  }

  // A revision never moves ELO or the streak. Both sides of the row are
  // pinned to the parent's final rating so the verdict page can still show
  // a delta of zero rather than a null, and so a revision can't be farmed
  // for rating by rewriting one good argument repeatedly.
  const eloBefore = isRevision
    ? Number(parent!.elo_after ?? profile.elo ?? 1200)
    : Number(profile.elo ?? 1200);
  const { eloAfter } = isRevision
    ? { eloAfter: eloBefore }
    : soloElo(eloBefore, Number(topic.par_elo), verdict.score);

  await admin
    .from("debates")
    .update({
      verdict: { ...storedVerdict, prompt_version: PROMPT_VERSION },
      score: verdict.score,
      prompt_version: PROMPT_VERSION,
      elo_before: eloBefore,
      elo_after: eloAfter,
    })
    .eq("id", debateId);

  // Streak: only a qualifying (score >= 40) judged debate counts as a day.
  // Computed opportunistically here, not via a scheduled job — see
  // docs/decisions.md.
  let streakResult = null;
  if (!isRevision && isStreakEligible(verdict.score)) {
    streakResult = applyStreakDay({
      streak: profile.streak ?? 0,
      streakUpdatedOn: profile.streak_updated_on,
    });
  }

  // Nothing to write on a revision: the rating is unchanged by definition
  // and the streak was skipped above.
  if (!isRevision) {
    await admin
      .from("profiles")
      .update({
        elo: eloAfter,
        ...(streakResult
          ? { streak: streakResult.streak, streak_updated_on: streakResult.streakUpdatedOn }
          : {}),
      })
      .eq("id", user.id);
  }

  // Challenge pairing: record this side's debate, and if the other side
  // has already judged theirs, recompute both with the pairwise rule.
  let challengeCompletion: { completed: boolean; winnerSchool?: string } | null = null;
  if (body.challengeId) {
    const { data: challenge } = await admin
      .from("challenges")
      .select("challenger_result_id, challengee_result_id")
      .eq("id", body.challengeId)
      .maybeSingle();
    if (challenge) {
      const side = await resolveChallengeSide(admin, challenge, user.id);
      if (side) {
        challengeCompletion = await recordChallengeDebate(admin, body.challengeId, side, debateId);
      }
    }
  }

  // par_elo is the true rolling mean of the last 50 participants'
  // elo_before, recomputed directly rather than maintained incrementally —
  // one indexed query, exact, no drift. Revisions are excluded from both the
  // write trigger and the window: a revision's elo_before is a copy of its
  // parent's elo_after, so counting it would weight one participant twice.
  if (!isRevision) {
    const { data: recentElos } = await admin
      .from("debates")
      .select("elo_before")
      .eq("topic_slug", topic.slug)
      .eq("kind", "original")
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
  }

  // The client fires revision_judged/objection_resolved, for the same reason
  // elo_changed is fired there: these are once-per-judgement facts, and the
  // verdict page re-renders on every later visit.
  const revisionSummary =
    isRevision && parent
      ? {
          parentDebateId: parent.id,
          objectionAnswered: verdict.objection_answered === true,
          scoreDelta: verdict.score - Number(parentVerdict?.score ?? verdict.score),
          fidelityDelta:
            Math.round(
              (verdict.fidelity - Number(parentVerdict?.fidelity ?? verdict.fidelity)) * 10
            ) / 10,
          daysOpen: parent.created_at
            ? Math.max(
                0,
                Math.floor((Date.now() - new Date(parent.created_at).getTime()) / 86_400_000)
              )
            : 0,
        }
      : null;

  return NextResponse.json({
    ok: true,
    debateId,
    eloDelta: eloAfter - eloBefore,
    eloAfter,
    streak: streakResult ? { value: streakResult.streak, change: streakResult.change } : null,
    challenge: challengeCompletion,
    revision: revisionSummary,
  });
}
