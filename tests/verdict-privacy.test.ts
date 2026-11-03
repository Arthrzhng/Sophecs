import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Verdict } from "../src/components/debate/Verdict";
import { JUDGES_NOTE_SENTENCE, withoutJudgesNote } from "../src/lib/verdict-share";

/**
 * What a signed-out visitor can read on a verdict page, and what 2D did
 * not change about it.
 *
 * 2D added a second admin read to this page for `debates.motion_text`,
 * and Stage 2 of the brief of 2026-11-03 moved it into the view.
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

function render(opts: {
  argument: string | null;
  isOwner: boolean;
  argumentPublic: boolean;
  textWithheld?: boolean;
  verdict?: typeof VERDICT | Record<string, unknown>;
}) {
  return renderToStaticMarkup(
    createElement(Verdict, {
      debateId: "jjSZVZFBmu",
      topicSlug: "opaque-benefit",
      motion: MOTION,
      school: "utilitarianism",
      verdict: opts.verdict ?? VERDICT,
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
 * Where the motion's stored wording comes from, checked in the source.
 *
 * 2D read `debates.motion_text` with the admin client, beside the view,
 * on both surfaces. Stage 2 of the brief of 2026-11-03 moved the column
 * into `debates_public` (migration 0020) and took that read away, so
 * everything public on the page and the image comes from the view, and
 * the admin client no longer reads `debates` for it at all.
 */
const READERS = [
  "src/app/debate/[slug]/[debateId]/page.tsx",
  "src/app/debate/[slug]/[debateId]/opengraph-image.tsx",
];

describe("motion_text comes from debates_public", () => {
  it.each(READERS)("%s selects motion_text from the view", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8").replace(/\s+/g, " ");
    const viewRead = /\.from\("debates_public"\) ?\.select\( ?"([^"]*)" ?\)/.exec(source);
    expect(viewRead, `${file} should read debates_public`).not.toBeNull();
    expect(viewRead?.[1].split(",").map((c) => c.trim())).toContain("motion_text");
  });

  it.each(READERS)("%s no longer reads motion_text from debates", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8").replace(/\s+/g, " ");
    for (const m of source.matchAll(/\.from\("debates"\) ?\.select\( ?"([^"]*)" ?\)/g)) {
      expect(m[1], `${file} reads debates for ${m[1]}`).not.toContain("motion_text");
    }
  });

  it("leaves the OG image with no read of debates at all", () => {
    const og = fs.readFileSync(
      path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/opengraph-image.tsx"),
      "utf-8"
    );
    expect(og).not.toContain('from("debates")');
  });

  it("404s an unknown or mismatched debate before reading anything else", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"),
      "utf-8"
    );
    const guard = page.indexOf('if (!publicRow || publicRow.topic_slug !== slug) notFound();');
    const topic = page.indexOf('.from("debate_topics")');
    expect(guard, "the notFound guard").toBeGreaterThan(-1);
    expect(topic, "the topic read").toBeGreaterThan(-1);
    expect(guard, "the 404 guard must come before the next read").toBeLessThan(topic);
  });
});

/**
 * Migration 0018 and the page change that went with it: the judge quotes
 * the argument it scores, so a private argument's verdict shows everyone
 * but its author the scores and not the judge's words.
 */
// What debates_public returns for that row after 0018.
const WITHHELD_VERDICT = {
  ...VERDICT,
  strongest_move: null,
  weakest_move: null,
  a_stronger_version_would: null,
  verdict_line: null,
  unanswered_objection: { school: "virtue-ethics" as const, claim: null, why_it_stands: null },
};
const JUDGES_WORDS = [
  VERDICT.strongest_move,
  VERDICT.weakest_move,
  VERDICT.a_stronger_version_would,
  VERDICT.verdict_line,
  VERDICT.unanswered_objection.claim,
  VERDICT.unanswered_objection.why_it_stands,
];

describe("a private argument's verdict, seen by someone else", () => {
  const html = render({
    argument: null,
    isOwner: false,
    argumentPublic: false,
    textWithheld: true,
    verdict: WITHHELD_VERDICT,
  });

  it("says why the judge's words are not shown, in their place", () => {
    expect(html).toContain("The verdict on a private argument");
    expect(html).toContain(
      "The judge&#x27;s note can quote the argument, so only the person who wrote it can read it while the argument is private."
    );
    expect(html).toContain(
      "The argument left a Virtue Ethics objection standing. Its wording can quote the argument, so only the person who wrote it can read it."
    );
  });

  it("still shows the score and the three criteria", () => {
    expect(html).toContain(">72<");
    for (const mark of ["7.0", "6.0"]) expect(html).toContain(mark);
  });

  it("shows none of the judge's words even if the view still returned them", () => {
    // The page withholds them itself, so it is safe before 0018 is applied
    // as well as after: here the full verdict is passed in.
    const before0018 = render({ argument: null, isOwner: false, argumentPublic: false, textWithheld: true });
    for (const words of JUDGES_WORDS) expect(before0018).not.toContain(words);
  });
});

describe("the author's own verdict", () => {
  it("still shows everything the judge wrote", () => {
    const html = render({ argument: ARGUMENT_TEXT, isOwner: true, argumentPublic: false });
    for (const words of JUDGES_WORDS) expect(html).toContain(words);
    expect(html).not.toContain("The verdict on a private argument");
  });
});

describe("the share line without the judge's note", () => {
  const SCHOOLS = ["stoicism", "utilitarianism", "virtue-ethics", "confucian", "ubuntu", "buddhist"];

  it.each(SCHOOLS)("%s's template carries the sentence it removes, and keeps the rest", (id) => {
    const page = fs.readFileSync(path.join(process.cwd(), "content/schools", `${id}.md`), "utf-8");
    const template = /verdict_share_line: >-\n((?:  .*\n)+)/.exec(page)?.[1].replace(/\s+/g, " ").trim();
    expect(template, `${id} verdict_share_line`).toBeTruthy();
    expect(JUDGES_NOTE_SENTENCE.test(template!), `${id}: the sentence the helper removes`).toBe(true);
    const stripped = withoutJudgesNote(template!);
    expect(stripped).not.toContain("{verdict_line}");
    expect(stripped).not.toContain("The judge's note");
    for (const slot of ["{score}", "{topic}", "{slug}", "{id}"]) expect(stripped).toContain(slot);
  });
});

describe("the verdict page's own read", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"),
    "utf-8"
  );

  it("reads the author's verdict from debates, through RLS", () => {
    expect(page).toContain('.select("argument, argument_public, verdict")');
    expect(page).toContain("isOwner && ownVerdict ? ownVerdict : publicRow.verdict");
  });

  it("withholds the text for anyone but the author on a private argument", () => {
    expect(page).toContain("const textWithheld = !isOwner && !argumentPublic;");
    expect(page).toContain("textWithheld={textWithheld}");
    expect(page).toContain("withoutJudgesNote(schoolContent.verdict_share_line)");
  });
});
