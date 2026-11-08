// The AI tag and the rest of the minimum a reader sees of a sample account,
// and the view events a sample page does not send.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

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
const { SAMPLE_EXPLANATION, SAMPLE_JUDGE_NOTE, SCHOOLS_SAMPLE_LINE, SAMPLE_IMAGE_MARK } = await import("../../src/lib/sample");

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
  // Arthur, 2026-11-08: readers see "sample" as little as possible. The
  // minimum: a small AI tag beside a sample's work, the line before writing
  // to one (with the replies), a mark on its images, one line on /schools,
  // the explanation on /how-it-works.
  it("the tag says AI and opens to the explanation, Arthur's words", () => {
    const out = html(createElement(SampleLabel));
    expect(out).toMatch(/^<details/);
    expect(out).toContain(">AI<");
    expect(SAMPLE_EXPLANATION).toBe("Sample accounts are run by AI. They show what arguing here looks like.");
    expect(out).toContain(SAMPLE_EXPLANATION);
    expect(out).not.toMatch(/Sample</);
  });

  it("a template verdict carries the tag, says inside it the judge did not read it, and never claims the judge did", () => {
    const out = html(createElement(Verdict, { ...props, sample: { template: true } }));
    expect(out).toContain(">AI<");
    expect(out).toContain(`${SAMPLE_EXPLANATION} ${SAMPLE_JUDGE_NOTE}`);
    expect(SAMPLE_JUDGE_NOTE).toBe("The judge did not read this argument.");
    for (const claim of ["How the judge scored you", "The judge's note", "verdict is in", "How this was judged"]) expect(out).not.toContain(claim);
    for (const gone of ["Sample assessment", "sample assessment", "Written from a template", ">Sample<"]) expect(out).not.toContain(gone);
    expect(out.match(/<details/g)?.length).toBe(1);
    expect(out).not.toContain("Share");
    // The rejected view too.
    const rejected = html(createElement(Verdict, { ...props, verdict: { ...verdict, rejected: true }, sample: { template: true } }));
    expect(rejected).toContain(">AI<");
    expect(rejected).not.toContain("Sample assessment");
  });

  it("a genuine verdict is unchanged", () => {
    const out = html(createElement(Verdict, props));
    expect(out).toContain("How the judge scored you");
    expect(out).not.toContain(SAMPLE_EXPLANATION);
    expect(out).not.toContain(">AI<");
  });

  it("offers the motion's exemplars on a reader's own genuine verdict only", () => {
    const link = 'href="/debate/opaque-benefit/exemplars"';
    expect(html(createElement(Verdict, { ...props, isOwner: true }))).toContain(link);
    expect(html(createElement(Verdict, { ...props, isOwner: true, sample: { template: true } }))).not.toContain(link);
    expect(html(createElement(Verdict, props))).not.toContain(link);
  });

  it("a sample challenge is tagged, never someone's, and does not accept on the reader's behalf", () => {
    const content = { one_line: "x", name: "Stoicism" } as never;
    const out = html(createElement(ChallengeInvite, { challengeId: "c1", school: "stoicism", content, isSample: true }));
    expect(out).toContain(">AI<");
    expect(out).not.toContain("Someone challenged you");
    expect(out).not.toContain("A sample account's challenge");
    expect(out).toContain('href="/quiz"');
    expect(out).not.toContain("/quiz?c=c1");
    expect(html(createElement(ChallengeInvite, { challengeId: "c1", school: "stoicism", content }))).toContain("/quiz?c=c1");
  });

  it("a sample result is tagged and never presented as someone's", () => {
    const src = readFileSync("src/components/share/SharePage.tsx", "utf8");
    expect(src).toContain('{isSample ? "A result" : isOwner ? "Your school" : "Someone shared their result"}');
    expect(src).toContain("{isSample && <SampleLabel />}");
  });

  it("the school table has the one line on /schools, linked to the explanation, only in a week with samples", () => {
    expect(SCHOOLS_SAMPLE_LINE).toBe("Includes sample accounts, run by AI.");
    const base = { week: 44, rows: [], yourSchool: null, yourLine: null, emptyWeek: false, paused: false };
    const out = html(createElement(SchoolTable, { ...base, sampleNote: SCHOOLS_SAMPLE_LINE }));
    expect(out).toContain(SCHOOLS_SAMPLE_LINE);
    expect(out).toMatch(/href="\/(method|how-it-works)#samples"/);
    expect(out).not.toContain("What a sample account is");
    expect(html(createElement(SchoolTable, base))).not.toContain(SCHOOLS_SAMPLE_LINE);
  });

  it("no page title, banner, heading or note names a sample beyond the minimum", () => {
    const files = [
      "src/app/r/[id]/page.tsx", "src/app/c/[id]/page.tsx", "src/app/debate/[slug]/[debateId]/page.tsx",
      "src/components/debate/Verdict.tsx", "src/components/share/SharePage.tsx", "src/components/share/ChallengeInvite.tsx",
      "src/components/today/TodayCards.tsx", "src/components/table/SchoolTable.tsx",
    ];
    for (const f of files) {
      const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(code, f).not.toMatch(/"[^"]*\bSample\b[^"]*"|>[^<{]*\bSample\b[^<]*</);
      expect(code, f).not.toMatch(/sample account'?s? (result|challenge)|Sample verdict|· Sample ·|What a sample account is/i);
    }
    expect(readFileSync("src/components/card/CardLayout.tsx", "utf8")).toContain("{SAMPLE_IMAGE_MARK}");
    expect(readFileSync("src/components/debate/VerdictCard.tsx", "utf8")).toContain("{SAMPLE_IMAGE_MARK}");
    expect(SAMPLE_IMAGE_MARK).toBe("AI sample");
  });

  it("a sample verdict sends no view events; a genuine one does", () => {
    html(createElement(Verdict, { ...props, sample: { template: true } }));
    expect(tracked).toEqual([]);
    html(createElement(Verdict, props));
    expect(tracked.map((e) => e.name).sort()).toEqual(["objection_viewed", "verdict_viewed"]);
  });

  it("the result, challenge and verdict pages mark a sample page instead of tracking it", async () => {

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
