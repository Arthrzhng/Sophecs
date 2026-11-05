import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { rescreenPending } from "@/lib/rescreen";

// Re-screens arena replies left pending, once a day (vercel.json), under
// the route's own rules: src/lib/rescreen.ts. Arthur's ruling of
// 2026-11-05 on Checkpoint B, (d) 4, is the authority for this new file
// under the frozen src/app/api/**: a scheduled job on Vercel is a route,
// and the site's other cron is /api/cron/keepalive, which the canonical-
// host redirect leaves alone (next.config.ts).
//
// Vercel sends the cron secret as `Authorization: Bearer $CRON_SECRET`,
// checked here as /api/cron/keepalive checks it. The report holds counts
// only, no reply text and no ids, since Vercel's cron log keeps it.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }
  const admin = createAdminClient();
  try {
    const report = await rescreenPending(admin);
    // A reply screened ok whose exchange would not take the hand-over is
    // put back to pending, or, if that failed too, left stuck; either
    // makes a non-2xx, which is what shows in the cron log.
    const bad = report.failed + report.stuck;
    return NextResponse.json({ ok: bad === 0, ...report }, { status: bad ? 500 : 200 });
  } catch (err) {
    // A non-2xx is what shows in Vercel's cron log.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
