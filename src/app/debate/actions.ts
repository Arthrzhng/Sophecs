"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
