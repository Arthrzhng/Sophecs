/**
 * Whether two verdicts' scores may be set against each other: both judged
 * under the same prompt version, and that version known. Scores across
 * versions are not compared as equivalent (docs/decisions.md), and Arthur
 * ruled on 2026-11-07 (Gate 4 item 5, option (ii)) that no score change is
 * shown where the two verdicts' versions differ: not on the verdict page,
 * not in the share line. Elo and a topic's par are left as they are.
 *
 * Each verdict carries the version it was judged under, `prompt_version`
 * (src/app/api/judge/route.ts stores it in the verdict and on the row; a
 * sample's is its template's). A verdict without one cannot be shown to
 * match, so it is not compared.
 */
export function scoresComparable(a: unknown, b: unknown): boolean {
  return typeof a === "string" && a !== "" && a === b;
}
