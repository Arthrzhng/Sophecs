"use server";

import { cookies } from "next/headers";
import { newId } from "@/lib/ids";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileSchool } from "@/lib/claim";
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
  | { ok: true; id: string; challengerSchool?: SchoolId }
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

  const { error } = await admin.from("quiz_results").insert({
    id,
    anon_id: anonId,
    user_id: user?.id ?? null,
    school: input.primary,
    secondary: input.secondary,
    vector: input.vector,
    answers: input.answers,
    challenge_from: input.challengeId ?? null,
    referrer: input.referrer ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (user) {
    await ensureProfileSchool(admin, user.id, input.primary);
  }

  let challengerSchool: SchoolId | undefined;

  if (input.challengeId) {
    const { data: challenge } = await admin
      .from("challenges")
      .select("challenger_result_id")
      .eq("id", input.challengeId)
      .single();

    if (challenge) {
      const { data: challengerResult } = await admin
        .from("quiz_results")
        .select("school")
        .eq("id", challenge.challenger_result_id)
        .single();
      challengerSchool = challengerResult?.school as SchoolId | undefined;

      await admin
        .from("challenges")
        .update({ challengee_result_id: id, status: "accepted" })
        .eq("id", input.challengeId);
    }
  }

  return { ok: true, id, challengerSchool };
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
