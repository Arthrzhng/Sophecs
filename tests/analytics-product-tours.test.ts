// PostHog's product tours stay off in code, whatever the PostHog project
// says: the extension bundles a DOMPurify inside a critical advisory's
// range, and the site uses no tours (docs/decisions.md, "Dependency audit
// (2026-11-05)").
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const inits: Record<string, unknown>[] = [];
vi.mock("posthog-js", () => ({
  default: {
    init: (_key: string, opts: Record<string, unknown>) => inits.push(opts),
    identify: () => {},
    capture: () => {},
    sessionRecordingStarted: () => false,
    stopSessionRecording: () => {},
    startSessionRecording: () => {},
  },
}));

beforeEach(() => {
  inits.length = 0;
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { querySelector: () => null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("starts PostHog with product tours disabled", async () => {
  const a = await import("../src/lib/analytics/client");
  a.initAnalytics("anon-1");
  await new Promise((r) => setTimeout(r, 10));
  expect(inits).toHaveLength(1);
  expect(inits[0].disable_product_tours).toBe(true);
});
