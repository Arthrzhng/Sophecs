/**
 * Whether two verdicts' scores may be set against each other: both judged
 * under the same prompt version, and that version known. Scores across
 * versions are not compared as equivalent (docs/decisions.md), and Arthur
 * ruled on 2026-11-07 (Gate 4 item 5, option (ii)) that no score change is
 * shown where the two verdicts' versions differ: not on the verdict page,
 * in the share line, on /me or in the revision_judged event. Elo and a
 * topic's par are left as they are.
 *
 * Each row carries the version it was judged under in its own
 * `prompt_version` column (src/app/api/judge/route.ts writes it there and
 * in the verdict; a sample's is its template's, sample-template-1 or -2).
 * Read the column: debates_public drops a withheld verdict's copy unless
 * it reads v<n> (migration 0023). A row without one cannot be shown to
 * match, so it is not compared.
 */
export function scoresComparable(a: unknown, b: unknown): boolean {
  return typeof a === "string" && a !== "" && a === b;
}
