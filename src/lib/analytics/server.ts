import "server-only";
import { PostHog } from "posthog-node";
import type { AnalyticsEvent } from "./events";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
function getClient(): PostHog | null {
  if (!KEY) return null;
  if (!client) client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
  return client;
}

// Used by server actions and route handlers (including /api/track, the
// relay for events fired from server components) — anon_id is the distinct
// id until a user signs in.
export async function trackServer(event: AnalyticsEvent, anonId: string) {
  const posthog = getClient();
  if (!posthog) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics:server] dropped "${event.name}" — PostHog not configured`);
    }
    return;
  }
  posthog.capture({ distinctId: anonId, event: event.name, properties: event.props });
  await posthog.shutdown();
}
