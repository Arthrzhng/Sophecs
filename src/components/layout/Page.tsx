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
  children,
  className = "",
}: {
  width?: PageWidth;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex-1">
      <div className={`mx-auto ${WIDTHS[width]} px-6 pt-12 pb-20 ${className}`}>{children}</div>
    </main>
  );
}
