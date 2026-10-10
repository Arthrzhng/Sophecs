import type { ReactNode } from "react";

export type PageWidth = "ui" | "read" | "narrow";

// Three containers, not the five max-widths and nine arbitrary `max-w-[Nch]`
// values that were in use. `ui` for anything with tables and controls,
// `read` for anything you actually read, `narrow` for a single task in
// front of you.
//
// The 24px horizontal gutter is the same at every breakpoint. Vertical
// rhythm is 48px top / 80px bottom — the bottom is larger so the footer
// never looks stuck to the content.
const WIDTHS: Record<PageWidth, string> = {
  ui: "max-w-ui",
  read: "max-w-read",
  narrow: "max-w-narrow",
};

/**
 * Two vertical rhythms, which is one too many.
 *
 * `page` is 48 top / 80 bottom, what this component has always given. The
 * restyle's routes hand-rolled their own container while the daily-path
 * wrapper existed, because the wrapper had to sit on <main> and this
 * component owns that element; they settled on 40/40, and `path` is that.
 *
 * Deleting the wrapper brought them back here, and they keep their own
 * number. Collapsing the two is a design decision about how much air the
 * product's pages have, not a side effect of removing an attribute, and
 * nothing should change its spacing because a wrapper went away.
 */
const RHYTHM = {
  page: "pt-12 pb-20",
  path: "py-10",
} as const;

export function Page({
  width = "ui",
  tight = false,
  rhythm = "page",
  children,
  className = "",
}: {
  width?: PageWidth;
  /**
   * Halves the top gutter. For the landing page only, where the 48px of
   * approach costs the third answer row its place above a 360x640 fold.
   */
  tight?: boolean;
  rhythm?: keyof typeof RHYTHM;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex-1">
      <div
        className={`mx-auto ${WIDTHS[width]} px-6 ${
          tight ? "pt-6 pb-20" : RHYTHM[rhythm]
        } ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
