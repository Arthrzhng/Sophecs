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

// What survives a deletion and what doesn't:
//
// - profiles cascades via its own FK. reading_responses too (0010) — those
//   are private notes with no reason to outlive the account.
// - quiz_results, debates and ai_calls keep their rows with a null owner.
//   /r/[id] and a verdict page are public links, and deleting the rows
//   would 404 something a stranger may have bookmarked. quiz_results is
//   nulled here because its FK has no ON DELETE clause; the other two are
//   handled by the database since 0011.
// - an unpublished argument is deleted outright. It was never public, and
//   an orphaned row is no reason to keep someone's writing after they have
//   asked to be forgotten. A published one is kept, because publishing it
//   is exactly the consent that keeps it up.
export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  await admin.from("quiz_results").update({ user_id: null }).eq("user_id", user.id);
  await admin
    .from("debates")
    .update({ argument: null })
    .eq("user_id", user.id)
    .eq("argument_public", false);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
