// return_visit, when a visit starts on a sample page. track() drops
// anything sent from a sample page, so the flag that says "already sent
// this session" must not be set there: the first genuine page of the
// visit sends the event instead. The provider's effects are run by hand,
// since the suite has no DOM, and as React runs them: each on the first
// render and again only when its dependencies change.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects: (() => void)[] = [];
let slot = 0;
let lastDeps: (readonly unknown[] | undefined)[] = [];
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  useEffect: (fn: () => void, deps?: readonly unknown[]) => {
    const i = slot++;
    const prev = lastDeps[i];
    const first = prev === undefined && !(i in lastDeps);
    const changed = !deps || first || !prev || deps.length !== prev.length || deps.some((d, k) => !Object.is(d, prev[k]));
    lastDeps[i] = deps;
    if (changed) effects.push(fn);
  },
}));

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
let storageThrows = false;
beforeEach(() => {
  effects.length = 0;
  lastDeps = [];
  storageThrows = false;
  sent.length = 0;
  store.clear();
  marked = false;
  vi.resetModules();
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  vi.stubGlobal("document", { cookie: `anon_id=a1; anon_since=${encodeURIComponent(threeDaysAgo)}`, referrer: "" });
  const guard = () => {
    if (storageThrows) throw new Error("storage is not available");
  };
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => (guard(), store.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(), void store.set(k, v)),
  });
});
afterEach(() => vi.unstubAllGlobals());

// One render of the mounted provider at `to`: a client navigation, or the
// first page of a load when lastDeps is empty.
async function visit(to: string, sample: boolean, provider: () => unknown) {
  path = to;
  marked = sample;
  effects.length = 0;
  slot = 0;
  provider();
  for (const fn of effects) fn();
}
// A reload: a new module, and React mounting it afresh.
async function reload() {
  vi.resetModules();
  lastDeps = [];
  return (await import("../../src/components/analytics-provider")).AnalyticsProvider;
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
    await visit("/", false, await reload());
    await visit("/", false, await reload());
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
  });

  it("without sessionStorage, is sent once per page load, however many pages it shows", async () => {
    storageThrows = true;
    const provider = await reload();
    await visit("/r/SAMPLE01", true, provider);
    await visit("/", false, provider);
    await visit("/quiz", false, provider);
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(1);
    await visit("/", false, await reload());
    expect(sent.filter((n) => n === "return_visit")).toHaveLength(2);
  });
});
