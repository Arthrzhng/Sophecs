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

export function Page({
  width = "ui",
  tight = false,
  children,
  className = "",
}: {
  width?: PageWidth;
  /**
   * Halves the top gutter. For the landing page only, where the 48px of
   * approach costs the third answer row its place above a 360x640 fold.
   */
  tight?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex-1">
      <div className={`mx-auto ${WIDTHS[width]} px-6 ${tight ? "pt-6" : "pt-12"} pb-20 ${className}`}>
        {children}
      </div>
    </main>
  );
}
