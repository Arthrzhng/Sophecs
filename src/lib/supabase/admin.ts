import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service role. Server-only, never imported by client code. Used for:
// server actions that insert quiz_results (id/anon_id are generated
// server-side, not trusted from the client), and /r/[id] reads from the
// public_results view.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
