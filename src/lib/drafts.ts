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
 * builds as a 404 on every deployment. If a second caller ever appears,
 * this comment is wrong and the gate is worth re-checking.
 *
 * Pure, and free of `server-only`, so the content tests can import it.
 */

/** The part of a frontmatter object this module reads. */
export interface DraftStatus {
  status?: unknown;
}

export interface LoadOptions {
  /**
   * Load draft files as well as published ones. Only `/styleguide/drafts`
   * passes this. A production route that passes it is a bug.
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

/** Whether a loader should skip this file, given the caller's options. */
export function excluded(data: DraftStatus, { includeDrafts = false }: LoadOptions = {}): boolean {
  return isDraft(data) && !includeDrafts;
}
