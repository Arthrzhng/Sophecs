import fs from "node:fs";
import path from "node:path";
import { fidelityCriteriaFor, hasFidelityCriteria, rivalsOf } from "../../src/lib/judge/rubric";
import { objectionVoiceFor } from "../../src/lib/judge/objection-voices";
import { DRAFT_CRITERIA_ON_THIS_BUILD, parseDraftCriteria } from "../../src/lib/judge/draft-criteria";
import type { PromptVersion } from "../../src/lib/judge/schema";
import type { SchoolId } from "../../src/lib/types";

/**
 * Criteria for draft schools, for golden runs.
 *
 * Arthur's ruling of 2026-10-24: the approved criteria for the three draft
 * schools stay out of `src/lib/judge/rubric.ts` until he publishes those
 * schools, so on a build without SIX_SCHOOLS `/api/judge` keeps refusing
 * them. A golden run still has to score Tier B against them, so this module
 * reads them from `content/prompts/fidelity-criteria.draft.md` and hands
 * them to the runner.
 *
 * Gate 3 (Arthur, Checkpoint B, 2026-11-05) puts the same criteria into
 * what the judge receives on a SIX_SCHOOLS build, through
 * `src/lib/judge/draft-criteria.ts`, which reads the same file with the
 * same parser. A golden run with SIX_SCHOOLS=1 therefore judges the three
 * through that path, as a flag-on build would, and `planCase` checks the
 * text it sends is the text measured here.
 *
 * **Without the flag, nothing in `src/` reads that file.**
 * `tests/draft-criteria.test.ts` walks `src/` for its name, which only
 * `src/lib/judge/draft-criteria.ts` may carry, and drives `/api/judge`
 * itself to show it still refuses all three.
 * `tests/draft-criteria-reads.test.ts` records every path the filesystem is
 * asked for while the route runs, because a path assembled at runtime has
 * no name for the walk to find. If either ever failed, a flag-on exception
 * would have reached production.
 */

export const DRAFT_CRITERIA_FILE = path.join(
  process.cwd(),
  "content",
  "prompts",
  "fidelity-criteria.draft.md"
);

/**
 * The criteria sections of the draft file, keyed by school id, parsed by
 * the same function a SIX_SCHOOLS build uses (`parseDraftCriteria`), so
 * what a golden run measures and what that build sends cannot drift apart.
 * Each body is trimmed and otherwise untouched: line breaks are kept,
 * because the live criteria in `rubric.ts` keep theirs, and the length band
 * the criteria were written to is measured on the raw string.
 */
export function readDraftCriteria(
  text: string = fs.readFileSync(DRAFT_CRITERIA_FILE, "utf-8")
): Partial<Record<SchoolId, string>> {
  return parseDraftCriteria(text);
}

export type CasePlan =
  | { run: true; source: "live"; criteria: string; draftCriteria: undefined }
  // draftCriteria is the text callJudgeModel is handed in place of
  // rubric.ts, or undefined on a SIX_SCHOOLS build, where the judge's own
  // path already sends the same text (Gate 3).
  | { run: true; source: "draft"; criteria: string; draftCriteria: string | undefined }
  | { run: false; reason: string };

/**
 * Decide, before any call is made, whether a case runs and against what.
 *
 * - A live school is always judged against its live criteria for the
 *   prompt version being run: rubric.ts's text under v1 and v2, and that
 *   text plus its v3 vocabulary and objection paragraphs under v3, exactly
 *   as `callJudgeModel` builds it. The draft file is never consulted for it,
 *   and `callJudgeModel` refuses a draft override for a school that has
 *   live criteria in any case.
 * - A draft school runs only under a prompt that takes its rival schools
 *   from the registry. v1 and v2 name stoicism, utilitarianism and
 *   virtue-ethics in their prose and ask for an objection from "the two
 *   schools the argument was not assigned", which is incoherent for a
 *   school outside those three: there would be three. Running Tier B under
 *   v2 would buy verdicts against a prompt that cannot describe the task.
 * - A draft school with no section in the draft file is a broken fixture,
 *   and throws here, before anything is spent.
 */
export function planCase(
  school: SchoolId,
  promptTemplate: string,
  draft: Partial<Record<SchoolId, string>>,
  version: PromptVersion | "v3"
): CasePlan {
  const onThisBuild = DRAFT_CRITERIA_ON_THIS_BUILD[school] !== undefined;
  if (hasFidelityCriteria(school) && !onThisBuild) {
    return {
      run: true,
      source: "live",
      criteria: fidelityCriteriaFor(school, version),
      draftCriteria: undefined,
    };
  }
  const criteria = draft[school];
  if (criteria === undefined) {
    throw new Error(
      `golden fixture names "${school}", which has no criteria in ` +
        `src/lib/judge/rubric.ts or in content/prompts/fidelity-criteria.draft.md`
    );
  }
  // An empty section is not criteria. Judging against nothing is the
  // failure the rubric Proxy exists to prevent for live schools, and an
  // empty string would pass straight through the `??` in callJudgeModel,
  // so it is refused here, before anything is spent.
  if (criteria.trim() === "") {
    throw new Error(`the draft criteria for "${school}" are empty`);
  }
  if (!promptTemplate.includes("{{RIVAL_SCHOOLS}}")) {
    return {
      run: false,
      reason:
        "a draft school can only be judged under a prompt that lists rival " +
        "schools from the registry; this one counts them as two",
    };
  }
  // The same voice paragraph fidelityCriteriaFor adds for a live school
  // under v3, so the two kinds of school are told the same thing. Draft
  // schools only ever run under a prompt that lists rivals, which is v3.
  const withVoice = `${criteria.trimEnd()}\n\n${objectionVoiceFor(school, rivalsOf(school))}`;
  if (onThisBuild) {
    // A SIX_SCHOOLS build judges the three against this file already
    // (Gate 3), and callJudgeModel refuses an override for a school with
    // criteria. So the run goes through the build's own path, which is
    // what it should measure, after checking that path sends exactly the
    // text planned here.
    const sent = fidelityCriteriaFor(school, version);
    if (sent !== withVoice) {
      throw new Error(`the criteria a SIX_SCHOOLS build sends for "${school}" differ from the draft file's`);
    }
    return { run: true, source: "draft", criteria: withVoice, draftCriteria: undefined };
  }
  return { run: true, source: "draft", criteria: withVoice, draftCriteria: withVoice };
}
