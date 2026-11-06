import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLISHED_SCHOOL_IDS, SHOWN_SCHOOL_IDS, type SchoolId } from "@/lib/school-registry";

/**
 * The approved fidelity criteria of the three schools not yet published,
 * for the judge on a SIX_SCHOOLS build only (Gate 3, Arthur at Checkpoint
 * B, 2026-11-05: "The new schools' fidelity criteria go into what the judge
 * receives on flag-on builds only, and the three join the rival list on
 * flag-on builds").
 *
 * Arthur's ruling of 2026-10-24 keeps these criteria out of
 * `src/lib/judge/rubric.ts` until he publishes the schools, so they stay in
 * `content/prompts/fidelity-criteria.draft.md` and are read from there. On
 * a build without the flag `process.env.SIX_SCHOOLS` is the constant "0"
 * (next.config.ts), the file is never read, and the map is empty:
 * `/api/judge` refuses the three exactly as before, which
 * tests/draft-criteria.test.ts and tests/draft-criteria-reads.test.ts pin.
 *
 * Only the three this build shows are taken, never a published school's
 * section: a published school is always judged against its own criteria in
 * rubric.ts.
 */

/**
 * The criteria sections of the draft file, keyed by school id: a
 * `## \`id\`` heading and everything up to the next `## `. The body is
 * trimmed and otherwise untouched, because the criteria were written and
 * measured as raw text. The golden runner reads the file through this
 * function too, so a golden run measures what a flag-on build sends.
 */
export function parseDraftCriteria(text: string): Partial<Record<SchoolId, string>> {
  const out: Partial<Record<SchoolId, string>> = {};
  for (const section of text.split(/^## /m).slice(1)) {
    const newline = section.indexOf("\n");
    const heading = /^`([a-z-]+)`/.exec(section.slice(0, newline).trim());
    if (!heading) continue;
    out[heading[1] as SchoolId] = section.slice(newline).trim();
  }
  return out;
}

function flagOnDraftCriteria(): Partial<Record<SchoolId, string>> {
  const parsed = parseDraftCriteria(
    readFileSync(join(process.cwd(), "content", "prompts", "fidelity-criteria.draft.md"), "utf-8")
  );
  const out: Partial<Record<SchoolId, string>> = {};
  for (const id of SHOWN_SCHOOL_IDS) {
    if (PUBLISHED_SCHOOL_IDS.includes(id)) continue;
    const criteria = parsed[id];
    // An empty or missing section is not criteria: the school stays
    // unjudgeable rather than being judged against nothing.
    if (criteria !== undefined && criteria.trim() !== "") out[id] = criteria;
  }
  return out;
}

export const DRAFT_CRITERIA_ON_THIS_BUILD: Partial<Record<SchoolId, string>> =
  process.env.SIX_SCHOOLS === "1" ? flagOnDraftCriteria() : {};
