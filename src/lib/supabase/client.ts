"use client";

import { createBrowserClient } from "@supabase/ssr";

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// x-anon-id travels on every request so the "read own" RLS policy on
// quiz_results can match it against current_setting('request.headers').
export function createClient() {
  const anonId = readCookie("anon_id");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: anonId ? { "x-anon-id": anonId } : {} } }
  );
}
