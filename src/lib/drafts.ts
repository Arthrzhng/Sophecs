/**
 * Draft content.
 *
 * A content file carries `status: draft` while it is being written. Every
 * loader in `src/lib` hides draft files by default, so a draft is invisible
 * to every production route without that route knowing drafts exist.
 *
 * The opt-in is deliberately a single flag threaded through the loaders
 * rather than a second set of functions: one `includeDrafts`, passed by one
 * caller. That caller is `/styleguide/drafts`, which is gated on
 * SOPHECS_PREVIEW or VERCEL_ENV exactly as `/styleguide/arena` is, and so
 * builds as a 404 on every deployment. The one other is
 * `src/lib/micro-lessons.ts`, which passes it for the "elsewhere" passages
 * on a SIX_SCHOOLS build only (Stage 5). If a third caller ever appears,
 * this comment is wrong and the gate is worth re-checking.
 *
 * One more reader, on a `SIX_SCHOOLS` build only (docs/stage5-plan.md):
 * a draft that belongs to one of the three schools that build shows is
 * shown with them, by every loader, without `includeDrafts`. On any other
 * build there is no such school, and nothing here changes.
 *
 * Pure, and free of `server-only`, so the content tests can import it.
 */
import { PUBLISHED_SCHOOL_IDS, SHOWN_SCHOOL_IDS, type SchoolId } from "./school-registry";

/** The part of a frontmatter object this module reads. */
export interface DraftStatus {
  status?: unknown;
}

export interface LoadOptions {
  /**
   * Load draft files as well as published ones. Only `/styleguide/drafts`
   * passes this, and src/lib/micro-lessons.ts for the "elsewhere"
   * passages on a SIX_SCHOOLS build. Any other production caller is a bug.
   */
  includeDrafts?: boolean;
}

/**
 * Whether a file is a draft.
 *
 * Exactly the string `draft`, so a typo (`status: Draft`, `status: true`)
 * publishes rather than hides, which is the failure that gets noticed. The
 * opposite default would hide a finished file silently.
 */
export function isDraft(data: DraftStatus): boolean {
  return data.status === "draft";
}

/**
 * The schools this build shows without publishing: the three, on a
 * `SIX_SCHOOLS` build, and none on any other.
 */
export const SHOWN_DRAFT_SCHOOL_IDS: readonly SchoolId[] = SHOWN_SCHOOL_IDS.filter(
  (id) => !PUBLISHED_SCHOOL_IDS.includes(id)
);

/**
 * Whether a draft belongs to a school this build shows without publishing.
 * `school` is the file's own school: a school file's `id`, a module's
 * `school`. Anything that is not one of those strings belongs to none.
 */
export function shownDraftSchool(school: unknown): boolean {
  return typeof school === "string" && (SHOWN_DRAFT_SCHOOL_IDS as readonly string[]).includes(school);
}

/**
 * Whether a loader should skip this file, given the caller's options and,
 * where the file belongs to a school, that school.
 */
export function excluded(
  data: DraftStatus,
  { includeDrafts = false }: LoadOptions = {},
  school?: unknown
): boolean {
  return isDraft(data) && !includeDrafts && !shownDraftSchool(school);
}
