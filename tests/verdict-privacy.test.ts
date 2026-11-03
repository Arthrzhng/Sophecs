import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Verdict } from "../src/components/debate/Verdict";
import { JUDGES_NOTE_SENTENCE, shareTemplateFor, withoutJudgesNote } from "../src/lib/verdict-share";
import { KEPT_FOR_EVERYONE, withheldVerdict } from "../src/lib/verdict-privacy";

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

function render(opts: {
  argument: string | null;
  isOwner: boolean;
  argumentPublic: boolean;
  textWithheld?: boolean;
  verdict?: object;
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

  it("never hands the judge's words to the client, even when the view returns them", () => {
    // Before 0018 is applied, or after its rollback, debates_public returns
    // the whole verdict. The page cuts it down with withheldVerdict on the
    // server, and Verdict is a client component, so its props are the page
    // payload: what is checked here is everything the browser receives.
    const props = withheldVerdict(VERDICT);
    for (const words of JUDGES_WORDS) expect(JSON.stringify(props)).not.toContain(words);
    const html = render({ argument: null, isOwner: false, argumentPublic: false, textWithheld: true, verdict: props! });
    for (const words of JUDGES_WORDS) expect(html).not.toContain(words);
  });

  it("withholds a rejected argument's reason, and says so", () => {
    const rejected = { rejected: true, rejection_reason: "It only repeats the words secret plan.", prompt_version: "v2" };
    for (const verdict of [rejected, withheldVerdict(rejected)!]) {
      const html = render({ argument: null, isOwner: false, argumentPublic: false, textWithheld: true, verdict });
      expect(html).not.toContain("secret plan");
      expect(html).toContain(
        "The judge set this argument aside without a score. Its reason can quote the argument, so only the person who wrote it can read it."
      );
    }
    // The author still reads it.
    const own = render({ argument: ARGUMENT_TEXT, isOwner: true, argumentPublic: false, verdict: rejected });
    expect(own).toContain("secret plan");
  });

  it("withholds a revision's note on what changed", () => {
    const revision = { ...VERDICT, objection_answered: true, improvement_note: "Now answers it with the secret plan." };
    const comparison = { parentDebateId: "parent1", first: { score: 60, fidelity: 6, rigor: 6, engagement: 5 } };
    const withheld = renderToStaticMarkup(
      createElement(Verdict, {
        debateId: "rev1",
        topicSlug: "opaque-benefit",
        motion: MOTION,
        school: "utilitarianism",
        verdict: revision,
        eloDelta: null,
        eloAfter: null,
        shareLine: "s",
        afterLesson: null,
        argument: null,
        isOwner: false,
        argumentPublic: false,
        textWithheld: true,
        comparison,
      } as Parameters<typeof Verdict>[0])
    );
    expect(withheld).not.toContain("secret plan");
    expect(withheld).toContain("Objection answered.");
  });
});

describe("withheldVerdict", () => {
  it("keeps only the fields that cannot quote the argument", () => {
    expect(withheldVerdict(VERDICT)).toEqual({
      rejected: false,
      score: 72,
      fidelity: VERDICT.fidelity,
      rigor: VERDICT.rigor,
      engagement: VERDICT.engagement,
      unanswered_objection: { school: "virtue-ethics", claim: null, why_it_stands: null },
    });
  });

  it("drops any field it does not know, so a new one is withheld by default", () => {
    const withExtra = {
      ...VERDICT,
      notes: "secret",
      improvement_note: "secret",
      rejection_reason: "secret",
      unanswered_objection: { ...VERDICT.unanswered_objection, extra: "secret" },
    };
    expect(JSON.stringify(withheldVerdict(withExtra))).not.toContain("secret");
  });

  it("keeps a revision's and a v1 verdict's own scores and flags", () => {
    const revision = { ...VERDICT, objection_answered: false, prompt_version: "v2" };
    expect(withheldVerdict(revision)).toMatchObject({ objection_answered: false, prompt_version: "v2", score: 72 });
    const v1 = { rejected: false, score: 68, fidelity: 8, rigor: 6, engagement: 6, verdict_line: "secret", prompt_version: "v1" };
    expect(withheldVerdict(v1)).toEqual({ rejected: false, score: 68, fidelity: 8, rigor: 6, engagement: 6, prompt_version: "v1" });
  });

  it("drops an objection that is not an object, and anything that is not a verdict", () => {
    expect(withheldVerdict({ ...VERDICT, unanswered_objection: "secret" })).not.toHaveProperty("unanswered_objection");
    for (const odd of [null, "secret", ["secret"], 7]) expect(withheldVerdict(odd)).toBeNull();
  });

  it("is the list 0018 keeps, so the page and the view agree", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/0018_debates_public_private_verdict_text.sql"),
      "utf-8"
    );
    const list = /e\.key in \(([^)]*)\)/.exec(migration)?.[1];
    expect(list, "0018's list of kept keys").toBeTruthy();
    const keys = [...list!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(keys).toEqual([...KEPT_FOR_EVERYONE].sort());
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
  it("is used for someone else's view of a private argument, and only then", () => {
    const template = "Scored {score} on {topic}. The judge's note: {verdict_line}. sophecs.com/debate/{slug}/{id}";
    expect(shareTemplateFor(template, true)).toBe("Scored {score} on {topic}. sophecs.com/debate/{slug}/{id}");
    expect(shareTemplateFor(template, false)).toBe(template);
  });

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
    expect(page.replace(/\s+/g, " ")).toContain(
      "isOwner && ownVerdict ? ownVerdict : textWithheld ? withheldVerdict(publicRow.verdict) : publicRow.verdict"
    );
  });

  it("withholds the text for anyone but the author on a private argument", () => {
    expect(page).toContain("const textWithheld = !isOwner && !argumentPublic;");
    expect(page).toContain("textWithheld={textWithheld}");
    expect(page).toContain("shareTemplateFor(schoolContent.verdict_share_line, textWithheld)");
  });
});
