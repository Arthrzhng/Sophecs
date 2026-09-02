"use client";

import type { PostHog } from "posthog-js";
import type { AnalyticsEvent } from "./events";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

// posthog-js is loaded on demand, not bundled into the initial chunk every
// page ships — "zero third-party scripts... loaded after first paint" means
// the bytes, not just the init() call, arrive late. This keeps /quiz's
// critical bundle small; PostHog fetches in the background once the browser
// is idle after paint and is ready by the time anything worth tracking (an
// answered question) happens.
async function ensureClient(): Promise<PostHog | null> {
  if (client) return client;
  if (!KEY || typeof window === "undefined") return null;
  if (!loading) {
    loading = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // page_viewed is fired explicitly with our own props
      });
      client = posthog;
      return posthog;
    });
  }
  return loading;
}

export function initAnalytics(anonId: string) {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    ensureClient().then((posthog) => posthog?.identify(anonId));
  }, 0);
}

export function aliasToUser(userId: string) {
  ensureClient().then((posthog) => posthog?.alias(userId));
}

export function track(event: AnalyticsEvent) {
  ensureClient().then((posthog) => {
    if (!posthog) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[analytics] dropped "${event.name}" — PostHog not configured`, event.props);
      }
      return;
    }
    posthog.capture(event.name, event.props);
  });
}
