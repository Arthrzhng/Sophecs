// The sentence a verdict page offers to share (src/lib/verdict-share.ts):
// none for a sample account's verdict, whose verdict is a template the
// judge never read, and for a genuine one exactly what the page built
// before sample accounts existed.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { getSchool } from "../../src/lib/schools";
import { verdictShareLine, type VerdictShareInput } from "../../src/lib/verdict-share";

const genuine: VerdictShareInput = {
  sample: false,
  template: getSchool("stoicism").verdict_share_line,
  textWithheld: false,
  school: "stoicism",
  shortMotion: "AI tutors",
  score: 72,
  verdictLine: "It holds the line",
  slug: "ai-tutors",
  debateId: "d1",
  answeredObjection: null,
};
const answered = { ...genuine, answeredObjection: { school: "utilitarianism" as const, firstScore: 55 } };

/** The page's source with comments blanked, so a commented-out line cannot pass. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, " ");
}

describe("a verdict page's share sentence", () => {
  it("is the school's line for a genuine verdict, as before", () => {
    expect(verdictShareLine(genuine)).toBe(
      "Scored 72 defending the Stoic line on AI tutors. The judge's note: It holds the line. sophecs.com/debate/ai-tutors/d1"
    );
  });

  it("drops the judge's note for a reader who cannot see a private verdict's line, as before", () => {
    expect(verdictShareLine({ ...genuine, textWithheld: true })).toBe(
      "Scored 72 defending the Stoic line on AI tutors. sophecs.com/debate/ai-tutors/d1"
    );
  });

  it("is the movement for a genuine revision that answered its objection, as before", () => {
    expect(verdictShareLine(answered)).toBe(
      "Answered the Utilitarianism objection to my Stoicism case on AI tutors: 55 → 72. sophecs.com/debate/ai-tutors/d1"
    );
  });

  it("reads missing values exactly as main did", () => {
    // These read oddly. A rejected verdict (no score, no line) still gets a
    // share row, and a revision of a rejected original has no first score.
    // They are what main produced, pinned so that moving the sentence into
    // one function changes nothing for a genuine page.
    for (const verdictLine of [null, undefined]) {
      expect(verdictShareLine({ ...genuine, score: null, verdictLine })).toBe(
        "Scored  defending the Stoic line on AI tutors. The judge's note: . sophecs.com/debate/ai-tutors/d1"
      );
    }
    expect(verdictShareLine({ ...genuine, score: 0, verdictLine: "" })).toBe(
      "Scored 0 defending the Stoic line on AI tutors. The judge's note: . sophecs.com/debate/ai-tutors/d1"
    );
    expect(verdictShareLine({ ...answered, answeredObjection: { school: "utilitarianism", firstScore: null } })).toBe(
      "Answered the Utilitarianism objection to my Stoicism case on AI tutors: null → 72. sophecs.com/debate/ai-tutors/d1"
    );
    expect(verdictShareLine({ ...answered, score: null })).toBe(
      "Answered the Utilitarianism objection to my Stoicism case on AI tutors: 55 → null. sophecs.com/debate/ai-tutors/d1"
    );
  });

  it("is empty for a sample account's verdict, whichever line it would have been", () => {
    for (const v of [genuine, { ...genuine, textWithheld: true }, answered]) {
      expect(verdictShareLine({ ...v, sample: true })).toBe("");
    }
  });

  it("is built on the verdict page from the row's own sample marker", () => {
    const page = codeOnly(fs.readFileSync("src/app/debate/[slug]/[debateId]/page.tsx", "utf8"));
    // The marker is read with the row the page renders (generateMetadata's
    // own read of it does not count)...
    expect(page).toMatch(/const \{ data: publicRow \} = await admin \.from\("debates_public"\) \.select\( "[^"]*\bis_sample\b[^"]*" \)/);
    // ...passed, with every other value exactly as main used it, to the one
    // function that builds the sentence...
    expect(page).toContain("const school = publicRow.school as SchoolId;");
    expect(page).toContain("const shortMotion = shortMotionForShare(motion);");
    expect(page).toContain(
      "const shareLine = verdictShareLine({ sample: Boolean(publicRow.is_sample), " +
        "template: schoolContent.verdict_share_line, textWithheld, school, shortMotion, " +
        "score: verdict.score, verdictLine: verdict.verdict_line, slug, debateId, " +
        "answeredObjection: comparison && parentObjectionSchool && verdict.objection_answered " +
        "? { school: parentObjectionSchool, firstScore: comparison.first.score } : null, });"
    );
    // ...and nothing else on the page reads or fills in the school's template.
    expect(page.match(/verdict_share_line/g)).toHaveLength(1);
    // (The template's {slug} and {id} also appear as JSX expressions, so only
    // the three that cannot are looked for.)
    expect(page).not.toMatch(/\{(score|topic|verdict_line)\}/);
    expect(page).toMatch(/shareLine=\{shareLine\}/);
  });
});
