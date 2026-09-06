import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { claimAnonymousResults } from "@/lib/claim";

// Magic link and Google OAuth both land here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const anonId = cookieStore.get("anon_id")?.value;
  const { claimed } = await claimAnonymousResults(data.user.id, anonId);

  // No quiz result to attach to this account yet — the brief's flow is to
  // send them to take it, carrying the original destination through.
  if (!claimed) {
    const quizNext = next ?? "/debate";
    return NextResponse.redirect(`${origin}/quiz?next=${encodeURIComponent(quizNext)}`);
  }

  // welcome=1 tells /me to fire signup_completed/result_claimed exactly
  // once (it strips the param immediately after) — a server redirect can't
  // reach posthog-js directly, and firing on every /me visit would be
  // wrong. Only added on the claimed path: the quiz-first-then-signup
  // detour doesn't yet fire these — see docs/decisions.md.
  const target = new URL(next ?? "/me", origin);
  target.searchParams.set("welcome", "1");
  return NextResponse.redirect(target);
}
