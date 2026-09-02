import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic link and Google OAuth both land here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // /me is Phase 2 (profile, ELO, streak) — not built yet, so land on the
  // landing page rather than a route that doesn't exist.
  return NextResponse.redirect(`${origin}/`);
}
