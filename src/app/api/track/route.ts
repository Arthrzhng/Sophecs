import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { trackServer } from "@/lib/analytics/server";
import type { AnalyticsEvent } from "@/lib/analytics/events";

// Relay for events fired from server components/actions that can't reach
// posthog-js directly (e.g. quiz_abandoned via sendBeacon from a page that's
// unloading, or any future server-rendered trigger).
export async function POST(request: Request) {
  const event = (await request.json()) as AnalyticsEvent;
  const cookieStore = await cookies();
  const anonId = cookieStore.get("anon_id")?.value;

  if (!anonId || !event?.name) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await trackServer(event, anonId);
  return NextResponse.json({ ok: true });
}
