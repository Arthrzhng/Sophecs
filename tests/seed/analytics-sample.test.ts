// Nothing reaches PostHog from a page carrying the sample marker: not our
// own events, and not what PostHog sends by itself (autocapture,
// $identify, web vitals), which only before_send can stop. A visit that
// starts on a sample page does not load PostHog at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Opts = { before_send?: (e: unknown) => unknown };
const calls: { init: Opts[]; identify: string[]; capture: string[]; recording: string[] } = { init: [], identify: [], capture: [], recording: [] };
let recording = true;
vi.mock("posthog-js", () => ({
  default: {
    init: (_key: string, opts: Opts) => calls.init.push(opts),
    identify: (id: string) => calls.identify.push(id),
    capture: (name: string) => calls.capture.push(name),
    sessionRecordingStarted: () => recording,
    stopSessionRecording: () => ((recording = false), calls.recording.push("stop")),
    startSessionRecording: () => ((recording = true), calls.recording.push("start")),
  },
}));

let marked = false;
beforeEach(() => {
  calls.init = [];
  calls.identify = [];
  calls.capture = [];
  calls.recording = [];
  recording = true;
  marked = false;
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { querySelector: (sel: string) => (marked && sel === "[data-sophecs-sample-page]" ? {} : null) });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const settle = () => new Promise((r) => setTimeout(r, 10));

describe("PostHog and sample pages", () => {
  it("a visit that starts on a sample page loads nothing, and is identified on the first genuine page", async () => {
    const a = await import("../../src/lib/analytics/client");
    marked = true;
    a.initAnalytics("anon-1");
    a.track({ name: "page_viewed", props: { path: "/r/x", referrer: "" } } as never);
    await settle();
    expect(calls.init).toHaveLength(0);
    expect(calls.capture).toEqual([]);

    marked = false;
    a.track({ name: "page_viewed", props: { path: "/", referrer: "" } } as never);
    await settle();
    expect(calls.init).toHaveLength(1);
    expect(calls.identify).toEqual(["anon-1"]);
    expect(calls.capture).toEqual(["page_viewed"]);
  });

  it("drops whatever PostHog would send while a sample page is open", async () => {
    const a = await import("../../src/lib/analytics/client");
    a.initAnalytics("anon-2");
    await settle();
    const beforeSend = calls.init[0]?.before_send;
    expect(beforeSend).toBeTypeOf("function");
    const event = { event: "$autocapture", properties: {} };
    expect(beforeSend!(event)).toBe(event);
    marked = true;
    expect(beforeSend!(event)).toBeNull();
    expect(beforeSend!({ event: "$identify", properties: {} })).toBeNull();
  });

  it("drops batches recorded on a sample page and sent after the reader left it", async () => {
    const a = await import("../../src/lib/analytics/client");
    a.initAnalytics("anon-3");
    await settle();
    const beforeSend = calls.init[0]!.before_send!;
    // The reader opens a sample verdict, then goes back to a genuine page.
    marked = true;
    const leave = a.enterSamplePage("/debate/no-decision/SAMPLE01");
    const onSample = Date.now();
    marked = false;
    leave();
    // Heatmap data keyed by the sample page's address.
    expect(beforeSend({ event: "$$heatmap", properties: { $heatmap_data: { "https://sophecs.com/debate/no-decision/SAMPLE01": [] } } })).toBeNull();
    // An autocaptured click whose $current_url is the sample page.
    expect(beforeSend({ event: "$autocapture", properties: { $current_url: "https://sophecs.com/debate/no-decision/SAMPLE01?first=1" } })).toBeNull();
    // A replay chunk with anything recorded while the sample page was open.
    expect(beforeSend({ event: "$snapshot", properties: { $snapshot_data: [{ type: 3, timestamp: onSample }] } })).toBeNull();
    // Genuine pages and later replay still go.
    const genuine = { event: "$autocapture", properties: { $current_url: "https://sophecs.com/debate/no-decision/GENUINE1" } };
    expect(beforeSend(genuine)).toBe(genuine);
    const later = { event: "$snapshot", properties: { $snapshot_data: [{ type: 3, timestamp: Date.now() + 60_000 }] } };
    expect(beforeSend(later)).toBe(later);
  });

  it("pauses session replay while a sample page is open, and resumes it on a genuine one", async () => {
    const a = await import("../../src/lib/analytics/client");
    a.initAnalytics("anon-4");
    await settle();
    marked = true;
    const leaveFirst = a.enterSamplePage("/r/SAMPLE02");
    expect(calls.recording).toEqual(["stop"]);
    // From one sample page to another: still paused.
    const leaveSecond = a.enterSamplePage("/c/SAMPLE03");
    leaveFirst();
    expect(calls.recording).toEqual(["stop"]);
    marked = false;
    leaveSecond();
    expect(calls.recording).toEqual(["stop", "start"]);
  });
});
