/**
 * Where the product links to its explanatory pages and its table.
 *
 * On a SIX_SCHOOLS build the method and the rubric are one page,
 * `/how-it-works`, and the table is under the schools' cards at
 * `/schools` (Arthur, 2026-11-06; docs/daily-path-copy.md, section 13).
 * The old addresses redirect there, but a link should not rely on it: a
 * click follows a redirect by fetch, which drops the anchor, so a link to
 * `/debate/rubric` would land at the top of `/how-it-works` rather than
 * on the rubric. Every link goes straight to the right place instead.
 * Every other build, production included, links where it always has.
 */
const SIX = process.env.SIX_SCHOOLS === "1";

export const METHOD_HREF = SIX ? "/how-it-works" : "/method";
export const RUBRIC_HREF = SIX ? "/how-it-works#rubric" : "/debate/rubric";
export const SAMPLES_HREF = SIX ? "/how-it-works#samples" : "/method#samples";
export const COUNTERPART_RULES_HREF = SIX ? "/how-it-works#counterpart" : "/debate/rubric";
export const TABLE_HREF = SIX ? "/schools" : "/table";
