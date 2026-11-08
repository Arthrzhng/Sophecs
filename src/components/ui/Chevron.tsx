/**
 * The disclosure mark: a drawn chevron, never a character. iOS drew the
 * browser's own disclosure triangle (U+25B6) as an emoji, and several
 * arrows and triangles in Unicode have an emoji form; the ones the app
 * used or uses (U+25B8, U+2192, U+2190) do not, but no character is used
 * here at all
 * (Arthur, 2026-11-08: "a plain drawn chevron (SVG or
 * CSS, currentColor, rotates when open) ... no Unicode arrows or
 * triangles that a phone can turn into emoji").
 *
 * It points right while its <details> is closed and down while it is
 * open. The two poses are two paths swapped by state rather than one
 * rotated, because design/tokens.md, section 6, forbids any transform (a
 * disclosure may animate only its height and opacity). The <details> needs the `group` class; its <summary>
 * hides the browser's marker (`list-none [&::-webkit-details-marker]:hidden`).
 */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d="M6 3.5 10.5 8 6 12.5" className="group-open:hidden" />
      <path d="M3.5 6 8 10.5 12.5 6" className="hidden group-open:inline" />
    </svg>
  );
}
