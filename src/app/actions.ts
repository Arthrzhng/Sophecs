"use server";

import { cookies } from "next/headers";
import { newId } from "@/lib/ids";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { retakeQuizSchool } from "@/lib/claim";
import { schoolFromResult } from "@/lib/quiz-result";
import { quizV2, QUIZ_V2_ON } from "@/lib/quiz-v2";
import { scoreQuizV2, type MapPoint, type QuizV2Option } from "@/lib/quiz-v2-score";
import { scoreQuiz } from "@/lib/scoring";
import { QUIZ_QUESTIONS, type QuizOption } from "../../content/quiz/questions";
import type { SchoolId } from "@/lib/types";

export interface SubmitQuizResultInput {
  // Only the answers: the server scores them itself (below), as
  // submitQuizResultV2 does, and the page shows what it returns.
  answers: { q: number; opt: string }[];
  challengeId?: string | null;
  referrer?: string;
}

export type SubmitQuizResultOutput =
  | {
      ok: true;
      id: string;
      /** The school the server scored from the answers, which the page shows. */
      primary: SchoolId;
      secondary: SchoolId;
      challengerSchool?: SchoolId;
      schoolChanged?: { from: SchoolId; to: SchoolId };
    }
  | { ok: false; error: string };

// Called from /quiz/result. Generates the id, reads the anon_id cookie
// (bootstrapped by middleware on every request, so it always exists by the
// time the quiz finishes), and inserts via the admin client — RLS's insert
// policy is deliberately permissive (`with check (true)`) and trusts this
// server action, not the caller, to set anon_id correctly; RLS is what
// isolates *reads* between anonymous users, tested separately.
export async function submitQuizResult(
  input: SubmitQuizResultInput
): Promise<SubmitQuizResultOutput> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Supabase is not configured in this environment." };
  }

  const cookieStore = await cookies();
  const anonId = cookieStore.get("anon_id")?.value;
  if (!anonId) {
    return { ok: false, error: "Missing anonymous identity." };
  }

  // Scored here from the answers, never taken from the page (Arthur,
  // 2026-11-06: "fix the v1 quiz hole by scoring v1 on the server"). Until
  // then the school, secondary and vector the browser sent were stored as
  // given, so anyone could write any school to a result, a share card and,
  // signed in, their profile. Every one of the ten questions needs one of
  // its own options, in order; the scorer is the page's own
  // (src/lib/scoring.ts), so an honest page and the server always agree.
  const given = Array.isArray(input?.answers) ? input.answers : [];
  if (given.length !== QUIZ_QUESTIONS.length) return { ok: false, error: "Every question needs an answer." };
  const chosen: QuizOption[] = [];
  for (const [i, question] of QUIZ_QUESTIONS.entries()) {
    const answer = given[i];
    const option =
      answer && answer.q === question.id ? question.options.find((o) => o.id === answer.opt) : undefined;
    if (!option) return { ok: false, error: "Every question needs an answer." };
    chosen.push(option);
  }
  const scored = scoreQuiz(chosen);
  const primary: SchoolId = scored.primary;
  const secondary: SchoolId = scored.secondary;

  const id = newId();
  const admin = createAdminClient();

  // Phase 2: someone who signed in before ever taking the quiz (the
  // /quiz?next= path from /auth/callback) gets this result attached
  // directly, rather than waiting on a future claim. Doesn't touch the
  // Phase 1 anonymous path — anonId/RLS behavior is unchanged either way.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A challenge link (/quiz?c=<id>) names a challenge, but challenge_from
  // references quiz_results(id), and /r/[id] reads it as the challenger's
  // result. So the challenger's result id is what is stored. Until
  // 2026-11-04 the challenge's own id was written here, which failed the
  // foreign key and lost the reader's whole result. An unknown challenge
  // id is treated as no challenge, and so is a challenger opening their own
  // link (same browser or same account): they are not their own
  // challengee, and taking the slot would lock out the friend they sent it
  // to.
  let challenge: { challengerResultId: string; challengerSchool: SchoolId } | null = null;
  if (input.challengeId) {
    const { data: c } = await admin
      .from("challenges")
      .select("challenger_result_id, is_sample")
      .eq("id", input.challengeId)
      .maybeSingle();
    // A sample account's challenge is never accepted (docs/sample-activity.md):
    // its page sends readers to the quiz without it, and a link made by hand
    // is treated as no challenge.
    //
    // A challenger's school is read only from a result this build shows
    // (src/lib/quiz-result.ts): on a build without the flag a v2 challenger
    // is treated as no challenge, and its school is never read into a v1
    // reader's result. From the launch this quiz is retired: a SIX_SCHOOLS
    // build's quiz page writes v2 results, and nothing there calls this.
    if (c && !c.is_sample) {
      const { data: challenger } = await admin
        .from("quiz_results")
        .select("school, anon_id, user_id, quiz_version")
        .eq("id", c.challenger_result_id)
        .maybeSingle();
      const own = Boolean(challenger && (challenger.anon_id === anonId || (user && challenger.user_id === user.id)));
      const challengerSchool = challenger ? schoolFromResult(challenger) : null;
      if (challenger && !own && challengerSchool)
        challenge = { challengerResultId: c.challenger_result_id as string, challengerSchool };
    }
  }

  const { error } = await admin.from("quiz_results").insert({
    id,
    anon_id: anonId,
    user_id: user?.id ?? null,
    school: primary,
    secondary,
    vector: scored.vector,
    // As validated, in question order: only the q and opt of each answer.
    answers: chosen.map((option, i) => ({ q: QUIZ_QUESTIONS[i].id, opt: option.id })),
    challenge_from: challenge?.challengerResultId ?? null,
    referrer: input.referrer ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  let schoolChanged: { from: SchoolId; to: SchoolId } | undefined;
  if (user) {
    const result = await retakeQuizSchool(admin, user.id, primary);
    if (result.changed && result.from) {
      schoolChanged = { from: result.from, to: result.to };
    }
  }

  let challengerSchool: SchoolId | undefined;

  if (input.challengeId && challenge) {
    // Accepted once, by the first reader to finish: the challenge has one
    // challengee. Without the conditions, a link shared widely would let
    // each later reader replace the first, and reopen a finished
    // challenge. Nobody could accept one before the fix above, so this
    // changes no behaviour production has seen. Only the reader whose
    // update took the slot reports an acceptance (challenge_accepted).
    const { data: accepted } = await admin
      .from("challenges")
      .update({ challengee_result_id: id, status: "accepted" })
      .eq("id", input.challengeId)
      .eq("status", "open")
      .is("challengee_result_id", null)
      .select("id");
    if (accepted?.length) challengerSchool = challenge.challengerSchool;
  }

  return { ok: true, id, primary, secondary, challengerSchool, schoolChanged };
}

export interface SubmitQuizResultV2Input {
  answers: { q: number; opt: string }[];
  challengeId?: string | null;
  referrer?: string;
}

export type SubmitQuizResultV2Output =
  | {
      ok: true;
      id: string;
      primary: SchoolId;
      secondary: SchoolId;
      point: MapPoint;
      challengerSchool?: SchoolId;
      schoolChanged?: { from: SchoolId; to: SchoolId };
    }
  | { ok: false; error: string };

// Quiz v2's result, on a SIX_SCHOOLS build only (docs/stage5-plan.md,
// step 4; Arthur's Gate 2, option (i)). Called from /quiz/result on that
// build. Any build answers a server action, so this one refuses on a build
// without the flag rather than relying on no page calling it.
//
// The result is computed here from the answers, with the same scorer the
// quiz shows the reader (src/lib/quiz-v2-score.ts): the browser sends which
// option it chose for each question, never a school or a point. The row is
// v2 in shape, as 0027's check requires: a point, no vector.
//
// From the launch it does what v1 does: a signed-in reader's school moves
// to the result's (retakeQuizSchool), and it takes up any challenger's
// challenge, v1 or v2. Until launch it did neither (docs/decisions.md,
// "Stage 5, step 4", "To undo at launch"): a preview wrote into
// production's tables, and production would then have placed an account
// in a school it did not publish, or closed a production reader's
// challenge with a side it could not show.
export async function submitQuizResultV2(
  input: SubmitQuizResultV2Input
): Promise<SubmitQuizResultV2Output> {
  if (!QUIZ_V2_ON) return { ok: false, error: "This quiz is not available here." };
  if (!isAdminConfigured()) {
    return { ok: false, error: "Supabase is not configured in this environment." };
  }

  const anonId = (await cookies()).get("anon_id")?.value;
  if (!anonId) return { ok: false, error: "Missing anonymous identity." };

  const quiz = quizV2();
  const given = Array.isArray(input?.answers) ? input.answers : [];
  if (given.length !== quiz.questions.length) return { ok: false, error: "Every question needs an answer." };
  const chosen: QuizV2Option[] = [];
  for (const [i, question] of quiz.questions.entries()) {
    const answer = given[i];
    const option =
      answer && answer.q === question.id ? question.options.find((o) => o.id === answer.opt) : undefined;
    if (!option) return { ok: false, error: "Every question needs an answer." };
    chosen.push(option);
  }
  const scored = scoreQuizV2(chosen, quiz.schools);
  const primary = scored.primary as SchoolId;
  const secondary = scored.secondary as SchoolId;

  const id = newId();
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let challenge: { challengerResultId: string; challengerSchool: SchoolId } | null = null;
  if (input.challengeId) {
    const { data: c } = await admin
      .from("challenges")
      .select("challenger_result_id, is_sample")
      .eq("id", input.challengeId)
      .maybeSingle();
    if (c && !c.is_sample) {
      const { data: challenger } = await admin
        .from("quiz_results")
        .select("school, anon_id, user_id, quiz_version")
        .eq("id", c.challenger_result_id)
        .maybeSingle();
      const own = Boolean(challenger && (challenger.anon_id === anonId || (user && challenger.user_id === user.id)));
      const challengerSchool = challenger ? schoolFromResult(challenger) : null;
      if (challenger && !own && challengerSchool)
        challenge = { challengerResultId: c.challenger_result_id as string, challengerSchool };
    }
  }

  const { error } = await admin.from("quiz_results").insert({
    id,
    anon_id: anonId,
    user_id: user?.id ?? null,
    school: primary,
    secondary,
    vector: null,
    quiz_version: 2,
    map_x: scored.point.x,
    map_y: scored.point.y,
    answers: chosen.map((o, i) => ({ q: quiz.questions[i].id, opt: o.id })),
    challenge_from: challenge?.challengerResultId ?? null,
    referrer: input.referrer ?? null,
  });
  if (error) return { ok: false, error: error.message };

  let schoolChanged: { from: SchoolId; to: SchoolId } | undefined;
  if (user) {
    const result = await retakeQuizSchool(admin, user.id, primary);
    if (result.changed && result.from) schoolChanged = { from: result.from, to: result.to };
  }

  let challengerSchool: SchoolId | undefined;
  if (input.challengeId && challenge) {
    // Accepted once, by the first reader to finish, as v1's is.
    const { data: accepted } = await admin
      .from("challenges")
      .update({ challengee_result_id: id, status: "accepted" })
      .eq("id", input.challengeId)
      .eq("status", "open")
      .is("challengee_result_id", null)
      .select("id");
    if (accepted?.length) challengerSchool = challenge.challengerSchool;
  }

  return { ok: true, id, primary, secondary, point: scored.point, challengerSchool, schoolChanged };
}

export interface CreateChallengeOutput {
  ok: boolean;
  id?: string;
  error?: string;
}

// Called from ChallengeButton, on /r/[id] and on the quiz result page
// straight after the quiz. The row is created with only
// challenger_result_id in Phase 1 — see docs/decisions.md. Only the
// result's owner may challenge from it: the browser the quiz was taken in
// (its anon_id cookie) or the account the result is saved to. Anyone else
// gets the answer an unknown result gets; without the check, anyone could
// open a challenge in another reader's name through this action.
export async function createChallenge(resultId: string): Promise<CreateChallengeOutput> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Supabase is not configured in this environment." };
  }
  const admin = createAdminClient();
  const { data: result } = await admin
    .from("quiz_results")
    .select("anon_id, user_id")
    .eq("id", resultId)
    .maybeSingle();
  const anonId = (await cookies()).get("anon_id")?.value;
  let isOwner = Boolean(result && anonId && result.anon_id === anonId);
  if (result && !isOwner && result.user_id) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = Boolean(user && user.id === result.user_id);
  }
  if (!isOwner) return { ok: false, error: "Unknown result." };
  const id = newId();
  const { error } = await admin
    .from("challenges")
    .insert({ id, challenger_result_id: resultId, status: "open" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}
