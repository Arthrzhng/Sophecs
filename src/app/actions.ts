"use server";

import { cookies } from "next/headers";
import { newId } from "@/lib/ids";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { retakeQuizSchool } from "@/lib/claim";
import type { SchoolId, SchoolVector } from "@/lib/types";

export interface SubmitQuizResultInput {
  primary: SchoolId;
  secondary: SchoolId;
  vector: SchoolVector;
  answers: { q: number; opt: string }[];
  challengeId?: string | null;
  referrer?: string;
}

export type SubmitQuizResultOutput =
  | {
      ok: true;
      id: string;
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
  // id is treated as no challenge.
  const { data: challenge } = input.challengeId
    ? await admin
        .from("challenges")
        .select("challenger_result_id")
        .eq("id", input.challengeId)
        .maybeSingle()
    : { data: null };

  const { error } = await admin.from("quiz_results").insert({
    id,
    anon_id: anonId,
    user_id: user?.id ?? null,
    school: input.primary,
    secondary: input.secondary,
    vector: input.vector,
    answers: input.answers,
    challenge_from: (challenge?.challenger_result_id as string | undefined) ?? null,
    referrer: input.referrer ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  let schoolChanged: { from: SchoolId; to: SchoolId } | undefined;
  if (user) {
    const result = await retakeQuizSchool(admin, user.id, input.primary);
    if (result.changed && result.from) {
      schoolChanged = { from: result.from, to: result.to };
    }
  }

  let challengerSchool: SchoolId | undefined;

  if (input.challengeId && challenge) {
    const { data: challengerResult } = await admin
      .from("quiz_results")
      .select("school")
      .eq("id", challenge.challenger_result_id)
      .single();
    challengerSchool = challengerResult?.school as SchoolId | undefined;

    // Accepted once, by the first reader to finish: the challenge has one
    // challengee. Without the conditions, a link shared widely would let
    // each later reader replace the first, and reopen a finished
    // challenge. Nobody could accept one before the fix above, so this
    // changes no behaviour production has seen.
    await admin
      .from("challenges")
      .update({ challengee_result_id: id, status: "accepted" })
      .eq("id", input.challengeId)
      .eq("status", "open")
      .is("challengee_result_id", null);
  }

  return { ok: true, id, challengerSchool, schoolChanged };
}

export interface CreateChallengeOutput {
  ok: boolean;
  id?: string;
  error?: string;
}

// Called from ChallengeButton on /r/[id]. The row is created with only
// challenger_result_id in Phase 1 — see docs/decisions.md.
export async function createChallenge(resultId: string): Promise<CreateChallengeOutput> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Supabase is not configured in this environment." };
  }
  const admin = createAdminClient();
  const id = newId();
  const { error } = await admin
    .from("challenges")
    .insert({ id, challenger_result_id: resultId, status: "open" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}
