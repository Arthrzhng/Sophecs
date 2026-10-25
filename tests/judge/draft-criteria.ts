import fs from "node:fs";
import path from "node:path";
import { FIDELITY_CRITERIA, hasFidelityCriteria } from "../../src/lib/judge/rubric";
import type { SchoolId } from "../../src/lib/types";

/**
 * Criteria for draft schools, for golden runs only.
 *
 * Arthur's ruling of 2026-10-24: the approved criteria for the three draft
 * schools stay out of `src/lib/judge/rubric.ts` until he publishes those
 * schools in Phase 3, so `/api/judge` keeps refusing them. A golden run
 * still has to score Tier B against them, so this module reads them from
 * `content/prompts/fidelity-criteria.draft.md` and hands them to the
 * runner, and nothing else.
 *
 * **Nothing in `src/` may import this or read that file.**
 * `tests/draft-criteria.test.ts` walks `src/` for both and drives
 * `/api/judge` itself to show it still refuses all three. If either ever
 * failed, the eval's exception would have reached production.
 */

export const DRAFT_CRITERIA_FILE = path.join(
  process.cwd(),
  "content",
  "prompts",
  "fidelity-criteria.draft.md"
);

/**
 * The criteria sections of the draft file, keyed by school id.
 *
 * A section is a `## \`id\`` heading and everything up to the next `## `.
 * The body is trimmed and otherwise untouched: line breaks are kept,
 * because the live criteria in `rubric.ts` keep theirs, and the length band
 * the criteria were written to is measured on the raw string. Normalising
 * whitespace here would send the judge something other than what was
 * approved and measured.
 */
export function readDraftCriteria(
  text: string = fs.readFileSync(DRAFT_CRITERIA_FILE, "utf-8")
): Partial<Record<SchoolId, string>> {
  const out: Partial<Record<SchoolId, string>> = {};
  for (const section of text.split(/^## /m).slice(1)) {
    const newline = section.indexOf("\n");
    const heading = /^`([a-z-]+)`/.exec(section.slice(0, newline).trim());
    if (!heading) continue;
    out[heading[1] as SchoolId] = section.slice(newline).trim();
  }
  return out;
}

export type CasePlan =
  | { run: true; source: "live"; criteria: string; draftCriteria: undefined }
  | { run: true; source: "draft"; criteria: string; draftCriteria: string }
  | { run: false; reason: string };

/**
 * Decide, before any call is made, whether a case runs and against what.
 *
 * - A live school is always judged against its live criteria. The draft
 *   file is never consulted for it, and `callJudgeModel` refuses a draft
 *   override for a school that has live criteria in any case.
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
  draft: Partial<Record<SchoolId, string>>
): CasePlan {
  if (hasFidelityCriteria(school)) {
    return { run: true, source: "live", criteria: FIDELITY_CRITERIA[school], draftCriteria: undefined };
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
  return { run: true, source: "draft", criteria, draftCriteria: criteria };
}
