"use client";

import type { CaptureResult, PostHog } from "posthog-js";
import type { AnalyticsEvent } from "./events";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
// The browser's anon id, when the first page of the visit showed a sample
// and PostHog was not loaded there: identified when a genuine page loads it.
let pendingIdentify: string | null = null;

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
        // Nothing leaves a page that shows a sample, whatever fires it:
        // autocapture, $identify, web vitals, heatmaps, replay. PostHog
        // loads on a genuine page and stays loaded when the reader moves on
        // to a sample one, so track()'s own check is not enough.
        before_send: (event) => (fromSamplePage(event) ? null : event),
        // The site uses no product tours. Off here rather than only in the
        // PostHog project, so a dashboard switch cannot load the extension
        // and the DOMPurify it bundles (critical advisory
        // GHSA-cg2g-xh64-v4q7; docs/decisions.md, "Dependency audit
        // (2026-11-05)").
        disable_product_tours: true,
      });
      if (pendingIdentify) posthog.identify(pendingIdentify);
      pendingIdentify = null;
      client = posthog;
      return posthog;
    });
  }
  return loading;
}

export function initAnalytics(anonId: string) {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    // A visit that starts on a sample page does not load PostHog at all.
    if (onSamplePage()) {
      pendingIdentify = anonId;
      return;
    }
    ensureClient().then((posthog) => posthog?.identify(anonId));
  }, 0);
}

export function aliasToUser(userId: string) {
  ensureClient().then((posthog) => posthog?.alias(userId));
}

/**
 * A page showing a sample account's verdict, result or challenge carries
 * this marker (SamplePageMarker), and nothing is sent to PostHog from it:
 * samples never reach analytics (docs/sample-activity.md, "Metrics").
 * Checked when each event is sent (track() and PostHog's before_send), so
 * a page the reader has already left cannot decide it.
 */
export const SAMPLE_PAGE_ATTRIBUTE = "data-sophecs-sample-page";

export function onSamplePage(): boolean {
  return typeof document !== "undefined" && document.querySelector(`[${SAMPLE_PAGE_ATTRIBUTE}]`) !== null;
}

// The sample pages this visit has shown, and when. PostHog batches some
// data and sends it later (heatmaps every second, replay in chunks), so a
// batch can leave after the reader has moved on: those are recognised by
// the address they carry or the time they were recorded.
const samplePaths = new Set<string>();
const sampleSpans: { from: number; to: number | null }[] = [];
// Replay records a page as it renders, a moment before the marker's
// effect runs; a margin either side covers that, at the cost of a second
// or two of genuine replay.
const SPAN_MARGIN_MS = 2_000;
let recordingHeld = false;

function pathOf(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url, "https://sophecs.com").pathname;
  } catch {
    return null;
  }
}

function inSampleSpan(t: unknown): boolean {
  return typeof t === "number" && sampleSpans.some((s) => t >= s.from - SPAN_MARGIN_MS && (s.to === null || t <= s.to + SPAN_MARGIN_MS));
}

/** Whether PostHog's before_send should drop this. */
export function fromSamplePage(event: CaptureResult | null): boolean {
  if (onSamplePage()) return true;
  if (!event) return false;
  const props = (event.properties ?? {}) as Record<string, unknown>;
  const isSample = (url: unknown) => {
    const p = pathOf(url);
    return p !== null && samplePaths.has(p);
  };
  if (isSample(props.$current_url)) return true;
  if (props.$heatmap_data && typeof props.$heatmap_data === "object" && Object.keys(props.$heatmap_data).some(isSample)) return true;
  if (Array.isArray(props.$snapshot_data) && props.$snapshot_data.some((d) => inSampleSpan((d as { timestamp?: unknown } | null)?.timestamp))) return true;
  return false;
}

/**
 * Called by SamplePageMarker when a sample page opens: remembers it, and
 * pauses session replay while it is open. The returned function resumes
 * replay once the reader is on a genuine page again.
 */
export function enterSamplePage(path: string): () => void {
  samplePaths.add(path);
  const span = { from: Date.now(), to: null as number | null };
  sampleSpans.push(span);
  if (client?.sessionRecordingStarted()) {
    client.stopSessionRecording();
    recordingHeld = true;
  }
  return () => {
    span.to = Date.now();
    if (recordingHeld && !onSamplePage()) {
      recordingHeld = false;
      client?.startSessionRecording();
    }
  };
}

export function track(event: AnalyticsEvent) {
  if (onSamplePage()) return;
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
