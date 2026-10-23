import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Verdict } from "../src/components/debate/Verdict";

/**
 * What a signed-out visitor can read on a verdict page, and what 2D did
 * not change about it.
 *
 * 2D added a second admin read to this page for `debates.motion_text`.
 * Privacy here has never depended on which query the motion comes from:
 * it is decided by `debates_public`, which nulls `argument` unless
 * `argument_public`, and by an RLS-gated read that is the only signal of
 * ownership. This renders the component at the boundary where that
 * decision becomes markup, for both cases, and checks that the motion is
 * visible in each — because a private argument must still show what it
 * was arguing.
 *
 * Nothing covered this before 2D.
 */

const MOTION =
  "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";
const ARGUMENT_TEXT = "The decision to deploy is the part that is up to us.";

const VERDICT = {
  rejected: false as const,
  score: 72,
  fidelity: 7,
  rigor: 7,
  engagement: 6,
  strongest_move: "Names the dichotomy of control and stays inside it.",
  weakest_move: "Does not say who carries the cost when the system is wrong.",
  a_stronger_version_would: "Separate the deployment decision from the outcome.",
  verdict_line: "A Stoic case that holds its own ground.",
  unanswered_objection: {
    school: "virtue-ethics" as const,
    claim: "Nobody can deliberate about a result they cannot inspect.",
    why_it_stands: "The argument never answers it.",
  },
};

function render(opts: { argument: string | null; isOwner: boolean; argumentPublic: boolean }) {
  return renderToStaticMarkup(
    createElement(Verdict, {
      debateId: "jjSZVZFBmu",
      topicSlug: "opaque-benefit",
      motion: MOTION,
      school: "utilitarianism",
      verdict: VERDICT,
      eloDelta: 8,
      eloAfter: 1208,
      shareLine: "Scored 72. sophecs.com",
      afterLesson: null,
      ...opts,
    } as Parameters<typeof Verdict>[0])
  );
}

describe("a verdict page seen by someone who does not own it", () => {
  it("hides an unpublished argument and says so", () => {
    const html = render({ argument: null, isOwner: false, argumentPublic: false });
    expect(html).toContain("The author has not published this argument.");
    expect(html).not.toContain(ARGUMENT_TEXT);
  });

  it("still shows the motion the argument was about", () => {
    // The point of 2D: the stored wording reaches the page whether or not
    // the argument itself is published.
    const html = render({ argument: null, isOwner: false, argumentPublic: false });
    expect(html).toContain(MOTION);
  });

  it("shows a published argument", () => {
    const html = render({ argument: ARGUMENT_TEXT, isOwner: false, argumentPublic: true });
    expect(html).toContain(ARGUMENT_TEXT);
    expect(html).not.toContain("The author has not published this argument.");
  });

  it("shows the motion on a published argument too", () => {
    const html = render({ argument: ARGUMENT_TEXT, isOwner: false, argumentPublic: true });
    expect(html).toContain(MOTION);
  });
});

/**
 * The shape of the read 2D added, checked in the source.
 *
 * Three properties Arthur asked to have pinned: it selects nothing but
 * `motion_text`, it is keyed to the debate the page is already rendering,
 * and it sits after the guard that 404s an unknown or mismatched debate,
 * so a missing row never reaches it.
 */
const READERS = [
  "src/app/debate/[slug]/[debateId]/page.tsx",
  "src/app/debate/[slug]/[debateId]/opengraph-image.tsx",
];

describe("the motion_text read 2D added", () => {
  it.each(READERS)("%s selects only motion_text, for only that debate", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
    const read = /admin\s*\n?\s*\.from\("debates"\)\s*\n?\s*\.select\("([^"]*)"\)\s*\n?\s*\.eq\("id",\s*debateId\)/;
    const match = read.exec(source.replace(/\s+/g, " ").replace(/ \./g, "."));
    expect(match, `${file} should read debates by the rendered debateId`).not.toBeNull();
    expect(match?.[1], "the select list").toBe("motion_text");
  });

  it("404s an unknown or mismatched debate before reading anything else", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"),
      "utf-8"
    );
    const guard = page.indexOf('if (!publicRow || publicRow.topic_slug !== slug) notFound();');
    const read = page.indexOf('.select("motion_text")');
    expect(guard, "the notFound guard").toBeGreaterThan(-1);
    expect(read, "the motion_text read").toBeGreaterThan(-1);
    expect(
      guard,
      "the 404 guard must come first, so a debate that does not exist is never read for"
    ).toBeLessThan(read);
  });

  it("only reads for a debate the OG route already found", () => {
    const og = fs.readFileSync(
      path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/opengraph-image.tsx"),
      "utf-8"
    );
    const found = og.indexOf("if (data) {");
    const read = og.indexOf('.select("motion_text")');
    expect(found).toBeGreaterThan(-1);
    expect(found).toBeLessThan(read);
  });
});
