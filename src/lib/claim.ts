import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolId } from "@/lib/types";

export interface ClaimResult {
  claimed: boolean;
  school: SchoolId | null;
}

// Shared by claimAnonymousResults (sign-in after quiz) and submitQuizResult
// (quiz after sign-in): creates the profile on first contact, or backfills
// school if the profile exists without one. Never overwrites an existing
// school — that's the "retake while signed in" path, deferred to 2c
// alongside ELO not resetting. See docs/decisions.md.
export async function ensureProfileSchool(
  admin: SupabaseClient,
  userId: string,
  school: SchoolId | null
): Promise<SchoolId | null> {
  const { data: existing } = await admin
    .from("profiles")
    .select("id, school")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    await admin.from("profiles").insert({ id: userId, school });
    return school;
  }
  if (!existing.school && school) {
    await admin.from("profiles").update({ school }).eq("id", userId);
    return school;
  }
  return existing.school ?? null;
}

// Runs once on /auth/callback, after the session exists. Attaches every
// anonymous quiz_results row matching the anon_id cookie to the signed-in
// user, then creates the profile if this is a first sign-in, or backfills
// its school if it was created without one. Does not touch school on a
// return sign-in with an existing school — that's the "retake while signed
// in" path, deferred to 2c alongside ELO (see docs/decisions.md), not the
// initial claim this function handles.
export async function claimAnonymousResults(
  userId: string,
  anonId: string | undefined
): Promise<ClaimResult> {
  const admin = createAdminClient();

  if (anonId) {
    await admin
      .from("quiz_results")
      .update({ user_id: userId })
      .eq("anon_id", anonId)
      .is("user_id", null);
  }

  const { data: latest } = await admin
    .from("quiz_results")
    .select("school")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestSchool = (latest?.school as SchoolId | undefined) ?? null;
  const school = await ensureProfileSchool(admin, userId, latestSchool);

  return { claimed: Boolean(latest), school };
}
