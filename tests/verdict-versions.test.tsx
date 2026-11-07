// Arthur, 2026-11-07, Gate 4 item 5: "Option (ii): no score change shown
// where the two verdicts' prompt versions differ; Elo and par unchanged."
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { scoresComparable } from "../src/lib/verdict-versions";

vi.mock("@/lib/analytics/client", () => ({ track: () => {} }));
const { Verdict } = await import("../src/components/debate/Verdict");

const verdict = {
  rejected: false, score: 74, fidelity: 8, rigor: 7, engagement: 6,
  strongest_move: "s", weakest_move: "w", a_stronger_version_would: "a", verdict_line: "A line.",
  unanswered_objection: { school: "utilitarianism" as const, claim: "c", why_it_stands: "y" },
  objection_answered: true, improvement_note: "Better.",
};
const props = {
  debateId: "r1", topicSlug: "opaque-benefit", motion: "A motion.", school: "stoicism" as const, verdict,
  eloDelta: null, eloAfter: null, weekNumber: 45, argument: "words", isOwner: true, argumentPublic: true,
  afterLesson: null, showAfterLessonInitially: false, shareLine: "share",
};
const first = { score: 61, fidelity: 6, rigor: 6, engagement: 4 };
const render = (comparable: boolean) =>
  renderToStaticMarkup(
    createElement(Verdict, { ...props, comparison: { parentDebateId: "o1", comparable, first } })
  ).replace(/&#x27;/g, "'");

describe("scores compared only within one version of the judge", () => {
  it("compares two verdicts only when both name the same version", () => {
    expect(scoresComparable("v2", "v2")).toBe(true);
    expect(scoresComparable("v2", "v3")).toBe(false);
    expect(scoresComparable("sample-template-1", "sample-template-2")).toBe(false);
    // A verdict that names no version cannot be shown to match.
    expect(scoresComparable(undefined, "v3")).toBe(false);
    expect(scoresComparable(undefined, undefined)).toBe(false);
    expect(scoresComparable("", "")).toBe(false);
  });

  it("shows the change on the verdict page within one version", () => {
    const html = render(true);
    expect(html).toContain("Compared with your first attempt");
    expect(html).toContain(">Change</th>");
    expect(html).toContain(">+13<");
    expect(html).not.toContain("earlier version of the judge");
  });

  it("shows no score, first or change, across two versions, and says why", () => {
    const html = render(false);
    expect(html).toContain(
      "The first attempt was judged by an earlier version of the judge, so the two scores are not compared."
    );
    expect(html).not.toContain("Compared with your first attempt");
    expect(html).not.toContain(">Change</th>");
    expect(html).not.toContain(">+13<");
    // What is not a score stays: whether the objection was answered, the
    // judge's note, and the way back to the first attempt.
    expect(html).toContain("Objection answered.");
    expect(html).toContain("Better.");
    expect(html).toContain('href="/debate/opaque-benefit/o1"');
  });

  it("gives the verdict page's comparison and share line the two versions", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"), "utf8");
    expect(page).toContain(
      "comparable: scoresComparable(\n          (parentVerdict as { prompt_version?: unknown }).prompt_version,\n          (publicRow.verdict as { prompt_version?: unknown } | null)?.prompt_version\n        ),"
    );
    // The share line's "{first} → {score}" only within one version.
    expect(page).toContain(
      "comparison && comparison.comparable && parentObjectionSchool && verdict.objection_answered"
    );
  });

  it("leaves Elo and par alone", () => {
    // Neither is computed from a comparison: the judge route moves them, and
    // this ruling does not touch it.
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/judge/route.ts"), "utf8");
    expect(route).not.toContain("scoresComparable");
  });
});
