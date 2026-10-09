import Link from "next/link";

/**
 * The bar above a reading: a way back to the index, and where you are in a
 * sequence when there is one to be in.
 *
 * `position` is optional because only the per-motion passages form a
 * sequence today. A module is one reading, so a bar claiming "Reading 1 of
 * 1" over a permanently full track would be furniture reporting nothing.
 *
 * The <progress> is unlabelled by design: the sentence beside it states the
 * same fact in words, which is how ProgressBar does it on the reading
 * check, and two names for one track is two announcements of it.
 */
export function ReadingTopBar({
  width = "read",
  sticky = false,
  position,
}: {
  /** Matches the column under it: `ui` only where a contents rail widens it. */
  width?: "read" | "ui";
  /**
   * Pins the bar to the top. For a module, whose counter follows the scroll
   * and would otherwise report the reading you are on from somewhere you
   * can no longer see. A passage's counter never changes, so its bar stays
   * at the top of the document and out of the way.
   */
  sticky?: boolean;
  position?: { index: number; total: number };
}) {
  const bar = (
    <div
      className={`mx-auto flex w-full items-center gap-4 px-6 py-5 ${
        width === "ui" ? "max-w-ui" : "max-w-read"
      }`}
    >
      <Link
        href="/lessons"
        aria-label="Back to lessons"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-chunky text-ink-mid"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      {position && (
        <>
          <progress
            value={position.index}
            max={position.total}
            className="dp-progress h-4 min-w-0 flex-1 appearance-none overflow-hidden rounded-full"
          >
            {position.index} of {position.total}
          </progress>
          <span className="shrink-0 text-sm font-extrabold text-ink-mid">
            Reading <span className="font-mono tabular">{position.index}</span> of{" "}
            <span className="font-mono tabular">{position.total}</span>
          </span>
        </>
      )}
    </div>
  );

  if (!sticky) return bar;
  return (
    <div className="sticky top-0 z-10 border-b-2 border-rule bg-paper" data-print="hide">
      {bar}
    </div>
  );
}
