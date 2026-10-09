import type { ReactNode } from "react";
import { ProgressBar } from "@/components/daily-path/ProgressBar";

function Close() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Scroll the step so its marked row is visible, and nothing else.
 *
 * The feedback bar takes the space the options were in, so on a phone the
 * tick can finish just below the fold of a container that has only now
 * become shorter. `scrollIntoView` would do this in one line and also
 * scroll every scrollable ancestor, which on the styleguide means the page
 * jumping to whichever frame mounted last. This moves one element.
 */
export function revealMark(root: HTMLElement | null): void {
  const scroller = root?.querySelector<HTMLElement>("[data-lesson-scroll]");
  const row = root?.querySelector<HTMLElement>('[data-mark="tick"]');
  if (!scroller || !row) return;
  const past = row.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom;
  if (past > 0) scroller.scrollTop += past;
}

/**
 * The lesson player's chrome: a way out, how far along you are, the step
 * itself, and a bar across the bottom for whatever the step has to say.
 *
 * A full-height column rather than a page. The step scrolls; the top bar
 * and the bottom bar do not, so the way out never scrolls off and the
 * feedback never has to be chased. Nothing here is positioned absolutely,
 * which is what lets the same component be the body of a modal dialog on
 * the route and sit in a framed box on the styleguide.
 *
 * The X is an icon with no label beside it, so it carries its name in
 * `aria-label`; 44px square, which is the floor for a tap target and also
 * the smallest the mockups draw it.
 */
export function LessonOverlay({
  value,
  max,
  label,
  onLeave,
  bottom,
  children,
}: {
  value: number;
  max: number;
  /** Announced, not drawn: the track above the question is bare. */
  label: string;
  onLeave: () => void;
  /** The full-width bar across the foot. Absent until there is one. */
  bottom?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-paper">
      {/* The bar sits in the same column the question does, so on a wide
          screen the track ends where the options end rather than running
          the whole width of the window. -ml-3 puts the X's 22px glyph on
          the column edge, not its 44px tap target. */}
      <div className="shrink-0 px-6 py-4">
        <div className="mx-auto flex max-w-read items-center gap-4">
          <button
            type="button"
            aria-label="Leave lesson"
            onClick={onLeave}
            className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-chunky text-ink-mid hover:text-ink"
          >
            <Close />
          </button>
          <ProgressBar className="min-w-0 flex-1" value={value} max={max} label={label} bare />
        </div>
      </div>

      {/* The step. Scrolls on its own so the bars above and below stay put.
          Centred by `my-auto` rather than by `justify-center`, which in a
          scroll container clips the top of anything taller than the box;
          an auto margin collapses to nothing instead and it scrolls. */}
      <div
        data-lesson-scroll
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8"
      >
        <div className="mx-auto my-auto w-full max-w-read">{children}</div>
      </div>

      {bottom && <div className="shrink-0">{bottom}</div>}
    </div>
  );
}
