// return_visit, when a visit starts on a sample page. track() drops
// anything sent from a sample page, so the flag that says "already sent
// this session" must not be set there: the first genuine page of the
// visit sends the event instead. The provider's effects are run by hand,
// since the suite has no DOM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects: (() => void)[] = [];
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), useEffect: (fn: () => void) => void effects.push(fn) }));

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path, useSearchParams: () => new URLSearchParams() }));

let marked = false;
const sent: string[] = [];
vi.mock("@/lib/analytics/client", () => ({
  initAnalytics: () => {},
  onSamplePage: () => marked,
  // As the real track() does: nothing from a sample page.
  track: (e: { name: string }) => void (marked || sent.push(e.name)),
}));

const store = new Map<string, string>();
beforeEach(() => {
  effects.length = 0;
  sent.length = 0;
  store.clear();
  marked = false;
  vi.resetModules();
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  vi.stubGlobal("document", { cookie: `anon_id=a1; anon_since=${encodeURIComponent(threeDaysAgo)}`, referrer: "" });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

async function visit(to: string, sample: boolean, provider: () => unknown) {
  path = to;
  marked = sample;
  effects.length = 0;
  provider();
  for (const fn of effects) fn();
}

describe("return_visit", () => {
  it("is sent from the first genuine page when the visit starts on a sample page, once", async () => {
    const { AnalyticsProvider } = await import("../../src/components/analytics-provider");
    await visit("/r/SAMPLE01", true, AnalyticsProvider);
    expect(sent).toEqual([]);
    await visit("/", false, AnalyticsProvider);
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
    await visit("/quiz", false, AnalyticsProvider);
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
  });

  it("is sent from the first page when that page is genuine, and not again", async () => {
    const { AnalyticsProvider } = await import("../../src/components/analytics-provider");
    await visit("/", false, AnalyticsProvider);
    await visit("/r/SAMPLE01", true, AnalyticsProvider);
    await visit("/quiz", false, AnalyticsProvider);
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
  });

  it("is not sent again in the same session after a reload", async () => {
    let mod = await import("../../src/components/analytics-provider");
    await visit("/", false, mod.AnalyticsProvider);
    vi.resetModules();
    mod = await import("../../src/components/analytics-provider");
    await visit("/", false, mod.AnalyticsProvider);
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
  });
});
