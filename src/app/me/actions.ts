"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setDisplayName(displayName: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const trimmed = displayName.trim().slice(0, 60);
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function setArgumentDefaultPublic(value: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ argument_default_public: value })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/settings");
  return { ok: true };
}

// Cascades profiles via its own FK (id references auth.users on delete
// cascade, set in Phase 1). quiz_results.user_id has no ON DELETE clause,
// so it's nulled first — required for the FK to allow the auth user delete
// at all, and matches the brief: results are kept, not deleted, since share
// links must not 404.
export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  await admin.from("quiz_results").update({ user_id: null }).eq("user_id", user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
