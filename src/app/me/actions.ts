"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import {
  newClassCode,
  normaliseClassCode,
  MAX_CLASS_NAME,
  MAX_JOINED_CLASSES,
  MAX_OWNED_CLASSES,
} from "@/lib/classes";

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

// --- Classes ---

export async function createClass(
  name: string
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const trimmed = name.trim().slice(0, MAX_CLASS_NAME);
  if (!trimmed) return { ok: false, error: "Give the class a name." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= MAX_OWNED_CLASSES) {
    return { ok: false, error: `You can own up to ${MAX_OWNED_CLASSES} classes.` };
  }

  // Retry on a code collision rather than trusting one draw. At 36^8 this
  // effectively never fires, but "effectively never" is not a reason to
  // hand someone an error instead of a second code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newClassCode();
    const { error } = await admin
      .from("classes")
      .insert({ id: newId(), code, owner_id: user.id, name: trimmed });
    if (!error) {
      revalidatePath("/me/settings");
      return { ok: true, code };
    }
    if (!error.message.includes("classes_code_key")) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Couldn't generate a class code. Try again." };
}

export async function joinClass(
  code: string
): Promise<{ ok: true; classId: string; name: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const normalised = normaliseClassCode(code);
  if (normalised.length !== 8) return { ok: false, error: "That code doesn't look right." };

  const admin = createAdminClient();
  const { data: klass } = await admin
    .from("classes")
    .select("id, name, owner_id")
    .eq("code", normalised)
    .maybeSingle();
  // Same message for a wrong code and a real one: a distinguishable error
  // turns this into an oracle for walking the code space.
  if (!klass) return { ok: false, error: "That code doesn't look right." };
  if (klass.owner_id === user.id) {
    return { ok: false, error: "You own this class." };
  }

  const { count } = await admin
    .from("class_members")
    .select("class_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_JOINED_CLASSES) {
    return { ok: false, error: `You can join up to ${MAX_JOINED_CLASSES} classes.` };
  }

  const { error } = await admin
    .from("class_members")
    .upsert({ class_id: klass.id, user_id: user.id }, { onConflict: "class_id,user_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/settings");
  return { ok: true, classId: klass.id as string, name: klass.name as string };
}

export async function leaveClass(classId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // The user-scoped client, not the admin one: "member leave self" is a
  // real policy and there is no reason to bypass it here.
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/settings");
  return { ok: true };
}
