import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Verdict } from "../src/components/debate/Verdict";
import { JUDGES_NOTE_SENTENCE, shareTemplateFor, withoutJudgesNote } from "../src/lib/verdict-share";
import { KEPT_FOR_EVERYONE, verdictForViewer, withheldVerdict } from "../src/lib/verdict-privacy";

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
 * Where the motion's stored wording comes from, checked in the source.
 *
 * 2D read `debates.motion_text` with the admin client, beside the view,
 * on both surfaces. Stage 2 of the brief of 2026-11-03 moved the column
 * into `debates_public` (migration 0020) and took that read away, so
 * everything public on the page and the image comes from the view, and
 * the admin client no longer reads `debates` for it at all.
 */
/** Source with comments removed (not inside strings: the files have none there). */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const READERS = [
  "src/app/debate/[slug]/[debateId]/page.tsx",
  "src/app/debate/[slug]/[debateId]/opengraph-image.tsx",
];

describe("motion_text comes from debates_public", () => {
  it.each(READERS)("%s selects motion_text from the view", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8").replace(/\s+/g, " ");
    // Every read of the view that loads a debate's content takes its
    // wording from there too. A read of the sample marker alone (the
    // verdict page's title) loads no content and is left out.
    const contentReads = [...source.matchAll(/\.from\("debates_public"\) ?\.select\( ?"([^"]*)" ?\)/g)]
      .map((m) => m[1].split(",").map((c) => c.trim()))
      .filter((cols) => !(cols.length === 1 && cols[0] === "is_sample"));
    expect(contentReads.length, `${file} should read debates_public`).toBeGreaterThan(0);
    for (const cols of contentReads) expect(cols).toContain("motion_text");
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

  it("passes the view's motion_text to motionForDebate on both surfaces", () => {
    // Comments stripped, so a comment quoting the call cannot stand in for it.
    const page = codeOnly(fs.readFileSync(path.join(process.cwd(), READERS[0]), "utf-8"));
    const og = codeOnly(fs.readFileSync(path.join(process.cwd(), READERS[1]), "utf-8"));
    expect(page).toContain(
      "const motion = motionForDebate(publicRow.motion_text as string | null, topic.motion)"
    );
    expect(og).toContain("motion = motionForDebate(data.motion_text as string | null, topic.motion)");
  });

  it("reads the topic on the OG image only for a debate it found", () => {
    // A debate the view does not return is a 404 before anything else is
    // read (tests/seed/challenge-preview.test.ts runs the route).
    const og = codeOnly(fs.readFileSync(path.join(process.cwd(), READERS[1]), "utf-8"));
    const guard = og.indexOf('if (!data) return new Response(null, { status: 404');
    const topic = og.indexOf('.from("debate_topics")');
    expect(guard, "the 404 guard").toBeGreaterThan(-1);
    expect(topic, "the topic read").toBeGreaterThan(-1);
    expect(guard, "the 404 guard must come before the topic read").toBeLessThan(topic);
    expect(og.split('.from("debate_topics")').length - 1, "one topic read").toBe(1);
  });
});

/**
 * 0020 is 0018's view with one column added, and its rollback is 0018's
 * view: checked on the SQL text itself, so a change anywhere else in the
 * verdict expression fails here even if no test row exercises it.
 */
describe("0020 and its rollback against 0018", () => {
  const body = (file: string, from: string) => {
    const sql = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
    return sql.slice(sql.indexOf(from)).trim();
  };
  const v18 = body("supabase/migrations/0018_debates_public_private_verdict_text.sql", "create or replace view");

  it("0020 adds d.motion_text as the last column and changes nothing else", () => {
    const v20 = body("supabase/migrations/0020_debates_public_motion_text.sql", "create or replace view");
    const expected = v18.replace(
      "case when d.argument_public then d.argument else null end as argument\n  from debates d",
      "case when d.argument_public then d.argument else null end as argument,\n    d.motion_text\n  from debates d"
    );
    expect(expected).not.toBe(v18);
    expect(v20).toBe(expected);
  });

  it("the rollback recreates 0018's view exactly, then sets the grants", () => {
    const rollback = body("supabase/rollback/0020_debates_public_motion_text.down.sql", "create view");
    const end = "left join debates p on p.id = d.parent_debate_id;";
    const view = rollback.slice(0, rollback.indexOf(end) + end.length);
    expect(view).toBe(v18.replace("create or replace view", "create view"));
    expect(rollback.slice(view.length)).toContain(
      "revoke all on public.debates_public from public, anon, authenticated;\ngrant select on public.debates_public to anon, authenticated;"
    );
  });
});

/**
 * Migration 0018 and the page change that went with it: the judge quotes
 * the argument it scores, so a private argument's verdict shows everyone
 * but its author the scores and not the judge's words.
 */
// What debates_public returns for that row after 0018.
// What the page hands Verdict for someone else's view of a private
// argument, and what debates_public returns for one after 0018.
const WITHHELD_VERDICT = withheldVerdict(VERDICT)!;
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

  it("keeps a field only with the type it is meant to have", () => {
    const wrongTypes = {
      rejected: "secret",
      score: "a secret score",
      fidelity: 7,
      rigor: null,
      engagement: 6,
      objection_answered: "secret",
      prompt_version: "secret words",
      unanswered_objection: { school: "a secret school", claim: "c", why_it_stands: "w" },
    };
    expect(withheldVerdict(wrongTypes)).toEqual({ fidelity: 7, rigor: null, engagement: 6 });
  });

  it("drops an objection that is not an object, and anything that is not a verdict", () => {
    expect(withheldVerdict({ ...VERDICT, unanswered_objection: "secret" })).not.toHaveProperty("unanswered_objection");
    for (const odd of [null, "secret", ["secret"], 7]) expect(withheldVerdict(odd)).toBeNull();
  });

  // 0020 redefines the view with 0018's expression and motion_text added,
  // so the live view's list is 0020's; both are held to the page's.
  it.each([
    "supabase/migrations/0018_debates_public_private_verdict_text.sql",
    "supabase/migrations/0020_debates_public_motion_text.sql",
    "supabase/rollback/0020_debates_public_motion_text.down.sql",
  ])("is the list %s keeps, so the page and the view agree", (file) => {
    const migration = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
    const list = /e\.key in \(([^)]*)\)/.exec(migration)?.[1];
    expect(list, `${file}'s list of kept keys`).toBeTruthy();
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

describe("verdictForViewer, the page's one privacy decision", () => {
  const base = { ownVerdict: null, publicVerdict: VERDICT, parentPublic: null };
  const words = (v: unknown) => JUDGES_WORDS.filter((w) => JSON.stringify(v).includes(w)).length;

  it("gives the author their whole verdict, private or public", () => {
    for (const publicArgument of [null, ARGUMENT_TEXT]) {
      const view = verdictForViewer({ ...base, isOwner: true, ownVerdict: VERDICT, publicArgument });
      expect(view.textWithheld).toBe(false);
      expect(words(view.verdict)).toBe(JUDGES_WORDS.length);
    }
  });

  it("withholds the judge's words from anyone else on a private argument", () => {
    const view = verdictForViewer({ ...base, isOwner: false, publicArgument: null });
    expect(view.textWithheld).toBe(true);
    expect(words(view.verdict)).toBe(0);
    expect(view.verdict).toEqual(withheldVerdict(VERDICT));
  });

  it("shows anyone the verdict on a public original", () => {
    const view = verdictForViewer({ ...base, isOwner: false, publicArgument: ARGUMENT_TEXT });
    expect(view.textWithheld).toBe(false);
    expect(words(view.verdict)).toBe(JUDGES_WORDS.length);
  });

  it("withholds a public revision's verdict when its original is private, which it can quote", () => {
    const hidden = verdictForViewer({ ...base, isOwner: false, publicArgument: ARGUMENT_TEXT, parentPublic: false });
    expect(hidden.textWithheld).toBe(true);
    expect(words(hidden.verdict)).toBe(0);
    const shown = verdictForViewer({ ...base, isOwner: false, publicArgument: ARGUMENT_TEXT, parentPublic: true });
    expect(shown.textWithheld).toBe(false);
  });

  it("treats an empty argument as unpublished", () => {
    expect(verdictForViewer({ ...base, isOwner: false, publicArgument: "" }).textWithheld).toBe(true);
  });
});

describe("the verdict page's wiring", () => {
  const page = fs
    .readFileSync(path.join(process.cwd(), "src/app/debate/[slug]/[debateId]/page.tsx"), "utf-8")
    .replace(/\s+/g, " ");

  it("reads the author's verdict from debates, through RLS", () => {
    expect(page).toContain('.select("argument, argument_public, verdict")');
  });

  it("decides privacy in verdictForViewer, from the view's own columns and the original's privacy", () => {
    expect(page).toContain(
      "verdictForViewer({ isOwner, ownVerdict, publicVerdict: publicRow.verdict, publicArgument: publicRow.argument as string | null, parentPublic, })"
    );
    expect(page).toContain('.select("id, verdict, argument_public")');
    expect(page).toContain("parentPublic = Boolean(parentRow?.argument_public);");
    expect(page).toContain("textWithheld={textWithheld}");
    // The share sentence is built by verdictShareLine, which passes
    // textWithheld to shareTemplateFor (tests/seed/share-sentence.test.ts).
    expect(page).toContain("verdictShareLine({ sample: Boolean(publicRow.is_sample), template: schoolContent.verdict_share_line, textWithheld,");
  });
});
