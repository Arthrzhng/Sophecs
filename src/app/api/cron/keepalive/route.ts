import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Supabase's free tier pauses a project after a week without activity, and
// restoring it is manual. A paused project takes the product down exactly
// when a seven-day returner arrives to answer their objection — the one
// visit the whole return loop is built around. One cheap query a day is
// enough to keep the clock from ever starting.
//
// Vercel sends the cron secret as `Authorization: Bearer $CRON_SECRET`.
// Checked by hand rather than in middleware so this route is self-contained
// and an unauthenticated call is a plain 401 rather than a redirect.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }

  // Any real read counts as activity. `debate_topics` is six rows and is
  // already indexed on `active`, so this costs essentially nothing and, by
  // touching a table the product actually uses, it also fails if the
  // service-role key has been rotated out from under the deployment.
  const admin = createAdminClient();
  const { error } = await admin
    .from("debate_topics")
    .select("slug", { count: "exact", head: true })
    .limit(1);

  // A 500 rather than a swallowed failure: Vercel's cron log is the only
  // place anyone would notice that the keep-alive stopped keeping anything
  // alive, and it only shows a non-2xx. `message` is empty when the request
  // never reached Supabase at all, which is the case worth naming.
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Could not reach Supabase." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
