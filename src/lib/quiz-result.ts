import type { SchoolId } from "./types";

/**
 * Which quiz a result came from, and what each build may do with it
 * (docs/stage5-plan.md, step 3; migration 0027).
 *
 * v1 is the first, three-school quiz: a result holds three school weights
 * in `vector`. v2 is the six-school quiz, on SIX_SCHOOLS builds, which
 * production is from the launch: a result holds a point on the map
 * (`map_x`, `map_y`) and no vector. The database holds each version to its shape; this module holds
 * the code to it, so a v2 row never reaches code written for v1 rows.
 *
 * Every reader of a result asks here rather than reading `quiz_version`
 * itself. A value this module does not know, a missing column included, is
 * neither version: nothing shows it and nothing takes a school from it.
 */

export type QuizVersion = 1 | 2;

/** The columns of `public_results` a result page reads. */
export const PUBLIC_RESULT_COLUMNS =
  "id, school, secondary, vector, challenge_from, created_at, is_sample, quiz_version, map_x, map_y";

type Versioned = { quiz_version?: unknown };

export function quizVersionOf(row: Versioned): QuizVersion | null {
  return row.quiz_version === 1 || row.quiz_version === 2 ? row.quiz_version : null;
}

/**
 * Whether this build shows a result: a v1 result on every build, a v2 one
 * only on a SIX_SCHOOLS build. A build without the flag answers a v2 result
 * as not found, the way it answers an unknown id, because a v2 result is in
 * one of six schools and such a build publishes three.
 *
 * Reads the flag as the constant next.config.ts writes in, so a flag-off
 * build drops the v2 branch.
 */
export function shownOnThisBuild(row: Versioned): boolean {
  const version = quizVersionOf(row);
  if (version === 1) return true;
  return process.env.SIX_SCHOOLS === "1" && version === 2;
}

/**
 * The versions this build shows, for a query that filters on
 * `quiz_version`: v1 on every build, and v2 on a SIX_SCHOOLS build.
 */
export function shownVersions(): QuizVersion[] {
  return process.env.SIX_SCHOOLS === "1" ? [1, 2] : [1];
}

/**
 * The school a result may give to something outside itself: an account on
 * sign-in, the other side named on a challenge, the challenger a reader is
 * set against. A result's school wherever this build shows the result.
 *
 * Until launch this was a v1 result's only, on every build (Gate 2, option
 * (i)): a preview wrote v2 results to production's tables, and production
 * would then have placed an account in a school it did not publish. The
 * launch merge, which turns the flag on for production, lifts it
 * (docs/decisions.md, "Stage 5, step 4", "To undo at launch"). A build
 * without the flag still takes nothing from a v2 result, since it cannot
 * show its school.
 */
export function schoolFromResult(row: Versioned & { school?: unknown }): SchoolId | null {
  return shownOnThisBuild(row) && typeof row.school === "string" ? (row.school as SchoolId) : null;
}

/**
 * Whether two results can be compared side by side, weight for weight.
 * Only two v1 results can: a v2 result has no weights, and the two quizzes
 * asked different questions, so a page that set them side by side would
 * imply a comparison that does not exist.
 */
export function comparable(a: Versioned, b: Versioned): boolean {
  return quizVersionOf(a) === 1 && quizVersionOf(b) === 1;
}
