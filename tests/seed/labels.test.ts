// The Sample label, the sample assessment wording, the table note, and the
// view events a sample page does not send.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const tracked: { name: string }[] = [];
vi.mock("@/lib/analytics/client", () => ({ track: (e: { name: string }) => tracked.push(e) }));
// renderToStaticMarkup runs no effects; run them inline so the view events
// a component would send in the browser are visible here.
vi.mock("react", async (orig) => {
  const actual = (await orig()) as typeof import("react");
  return { ...actual, useEffect: (fn: () => void) => void fn() };
});

const { SampleLabel } = await import("../../src/components/sample/SampleLabel");
const { Verdict } = await import("../../src/components/debate/Verdict");
const { ChallengeInvite } = await import("../../src/components/share/ChallengeInvite");
const { SchoolTable } = await import("../../src/components/table/SchoolTable");
const { SAMPLE_EXPLANATION, TABLE_SAMPLE_NOTE } = await import("../../src/lib/sample");

const verdict = {
  rejected: false, score: 72, fidelity: 7.5, rigor: 7, engagement: 6.5,
  strongest_move: "s", weakest_move: "w", a_stronger_version_would: "a", verdict_line: "A line.",
  unanswered_objection: { school: "utilitarianism" as const, claim: "c", why_it_stands: "y" },
};
const props = {
  debateId: "d1", topicSlug: "opaque-benefit", motion: "A motion.", school: "stoicism" as const, verdict,
  eloDelta: 4, eloAfter: 1204, weekNumber: 44, argument: "words", isOwner: false, argumentPublic: true,
  afterLesson: null, showAfterLessonInitially: false, shareLine: "share",
};
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");

beforeEach(() => void (tracked.length = 0));

describe("labels", () => {
  it("SampleLabel says Sample and opens to the explanation, verbatim", () => {
    const out = html(createElement(SampleLabel));
    expect(out).toContain(">Sample<");
    expect(out).toContain(SAMPLE_EXPLANATION);
    expect(SAMPLE_EXPLANATION).toBe("An illustrative account with generated activity, not an active member. It does not respond to messages or challenges.");
    expect(out).toMatch(/^<details/);
  });

  it("a template verdict is a sample assessment and never claims the judge read it", () => {
    const out = html(createElement(Verdict, { ...props, sample: { template: true } }));
    expect(out).toContain(SAMPLE_EXPLANATION);
    expect(out).toContain("Sample assessment");
    for (const claim of ["How the judge scored you", "The judge's note", "verdict is in", "How this was judged"]) expect(out).not.toContain(claim);
    expect(out).not.toContain("Share");
  });

  it("a genuine verdict is unchanged", () => {
    const out = html(createElement(Verdict, props));
    expect(out).toContain("How the judge scored you");
    expect(out).not.toContain(SAMPLE_EXPLANATION);
  });

  it("offers the motion's exemplars on a reader's own genuine verdict only", () => {
    const link = 'href="/debate/opaque-benefit/exemplars"';
    expect(html(createElement(Verdict, { ...props, isOwner: true }))).toContain(link);
    expect(html(createElement(Verdict, { ...props, isOwner: true, sample: { template: true } }))).not.toContain(link);
    expect(html(createElement(Verdict, props))).not.toContain(link);
  });

  it("a sample challenge is labelled and does not accept on the reader's behalf", () => {
    const content = { one_line: "x", name: "Stoicism" } as never;
    const out = html(createElement(ChallengeInvite, { challengeId: "c1", school: "stoicism", content, isSample: true }));
    expect(out).toContain(SAMPLE_EXPLANATION);
    expect(out).toContain('href="/quiz"');
    expect(out).not.toContain("/quiz?c=c1");
    expect(html(createElement(ChallengeInvite, { challengeId: "c1", school: "stoicism", content }))).toContain("/quiz?c=c1");
  });

  it("the school table says when sample accounts are in the week", () => {
    const base = { week: 44, rows: [], yourSchool: null, yourLine: null, emptyWeek: false, paused: false };
    expect(html(createElement(SchoolTable, { ...base, sampleNote: TABLE_SAMPLE_NOTE }))).toContain(TABLE_SAMPLE_NOTE);
    expect(html(createElement(SchoolTable, { ...base, sampleNote: TABLE_SAMPLE_NOTE }))).toContain('href="/method#samples"');
    expect(html(createElement(SchoolTable, base))).not.toContain(TABLE_SAMPLE_NOTE);
  });
});

describe("metrics", () => {
  it("a sample verdict sends no view events; a genuine one does", () => {
    html(createElement(Verdict, { ...props, sample: { template: true } }));
    expect(tracked).toEqual([]);
    html(createElement(Verdict, props));
    expect(tracked.map((e) => e.name).sort()).toEqual(["objection_viewed", "verdict_viewed"]);
  });

  it("the result, challenge and verdict pages mark a sample page instead of tracking it", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/app/r/[id]/page.tsx", "utf8")).toMatch(/\{result\.is_sample \? \(\s*<SamplePageMarker \/>\s*\) : \(\s*<CardViewTracker/);
    expect(readFileSync("src/app/c/[id]/page.tsx", "utf8")).toMatch(/\{challenge\.isSample \? <SamplePageMarker \/> : <ChallengeViewTracker/);
    expect(readFileSync("src/app/debate/[slug]/[debateId]/page.tsx", "utf8")).toMatch(/\{publicRow\.is_sample && <SamplePageMarker \/>\}/);
    // The exemplars page shows only sample arguments, so it is always marked.
    expect(readFileSync("src/app/debate/[slug]/exemplars/page.tsx", "utf8")).toMatch(/<Page width="read">\s*<SamplePageMarker \/>/);
    expect(readFileSync("src/app/debate/[slug]/exemplars/page.tsx", "utf8")).toContain("referrer: SAMPLE_PAGE_REFERRER");
  });

  it("nothing reaches PostHog from a page that carries the sample marker", async () => {
    // The real module: this file mocks it for the trackers above.
    const { onSamplePage, SAMPLE_PAGE_ATTRIBUTE } = await vi.importActual<typeof import("../../src/lib/analytics/client")>("../../src/lib/analytics/client");
    const { readFileSync } = await import("node:fs");
    // The marker component writes the attribute the client looks for.
    expect(readFileSync("src/components/sample/SamplePageMarker.tsx", "utf8")).toContain(`${SAMPLE_PAGE_ATTRIBUTE}=""`);
    // track() returns before loading PostHog when the marker is present.
    const src = readFileSync("src/lib/analytics/client.ts", "utf8");
    const body = src.slice(src.indexOf("export function track("));
    expect(body.indexOf("if (onSamplePage()) return;")).toBeGreaterThan(-1);
    expect(body.indexOf("if (onSamplePage()) return;")).toBeLessThan(body.indexOf("ensureClient()"));
    // Without a DOM (server rendering, tests), nothing is a sample page.
    expect(onSamplePage()).toBe(false);
  });
});
