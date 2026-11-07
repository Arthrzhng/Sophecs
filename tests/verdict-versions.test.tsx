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
    // Not the first score either, anywhere on the page.
    expect(html).not.toContain(">61<");
    expect(html).not.toMatch(/\b61\b/);
    // What is not a score stays: whether the objection was answered, the
    // judge's note, and the way back to the first attempt.
    expect(html).toContain("Objection answered.");
    expect(html).toContain("Better.");
    expect(html).toContain('href="/debate/opaque-benefit/o1"');
  });

  it("says nothing about versions of the judge for a sample's template verdicts", () => {
    const html = renderToStaticMarkup(
      createElement(Verdict, { ...props, isOwner: false, sample: { template: true }, comparison: { parentDebateId: "o1", comparable: false, first } })
    ).replace(/&#x27;/g, "'");
    expect(html).not.toContain("version of the judge");
    expect(html).not.toContain("Compared with your first attempt");
    expect(html).not.toMatch(/\b61\b/);
    expect(html).toContain("Objection answered.");
  });

  // The page itself, from rows as the database gives them, is
  // tests/verdict-versions-page.test.tsx.

  it("on /me, leaves a revision's score off beside its original's across two versions", async () => {
    const { ProfilePage } = await import("../src/components/me/ProfilePage");
    const me = (comparable: boolean, rejected = false) =>
      renderToStaticMarkup(
        createElement(ProfilePage, {
          school: null, displayName: null, elo: 1200, percentile: 50, streak: 0, streakUpdatedOn: null,
          today: "2026-11-07", ratingPoints: [], objections: [], weeklyMotion: null, hasAnyDebate: true,
          exchanges: [], pendingChallenges: [], caseStates: {}, allClosed: false,
          debates: [
            {
              id: "o1", topicSlug: "opaque-benefit", topicTitle: "The opaque benefit", score: 61, rejected: false,
              revision: { id: "r1", topicSlug: "opaque-benefit", score: 74, rejected, comparable },
            },
          ],
        })
      );
    expect(me(true)).toContain(">74<");
    const across = me(false);
    expect(across).not.toContain(">74<");
    expect(across).toContain(">61<");
    // The revision is still listed, and its own page shows its score.
    expect(across).toContain('href="/debate/opaque-benefit/r1"');
    // "not judged" is not a score, and stays.
    expect(me(false, true)).toContain("not judged");
    // /me compares the two rows' own versions.
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/me/page.tsx"), "utf8");
    expect(page).toContain("comparable: scoresComparable(d.prompt_version, revision.prompt_version),");
    expect(page.match(/parent_debate_id, prompt_version"\)/g)).toHaveLength(2);
  });

  it("records no score or fidelity change in revision_judged across two versions", () => {
    const revise = fs.readFileSync(path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/revise/page.tsx"), "utf8");
    expect(revise).toContain("comparableWithParent={scoresComparable(parent.prompt_version, PROMPT_VERSION)}");
    expect(revise).toMatch(/\.select\("[^"]*\bprompt_version"\)/);
    const editor = fs.readFileSync(path.join(process.cwd(), "src/components/debate/ArgumentEditor.tsx"), "utf8");
    expect(editor).toContain("score_delta: comparableWithParent ? response.revision.scoreDelta : null,");
    expect(editor).toContain("fidelity_delta: comparableWithParent ? response.revision.fidelityDelta : null,");
    expect(editor).toContain("comparableWithParent = true,");
  });

  it("gives the share line its first score only within one version", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"), "utf8");
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
