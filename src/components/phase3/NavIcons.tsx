/**
 * Candidates for the School table's navigation icon: Phase 3.0 preview
 * only. The brief of 2026-11-03 asks for "a neutral nav icon for School
 * table (the triangle no longer means anything)". The site header's links
 * carry no icons today (src/components/nav/SiteHeader.tsx), so this would
 * add one rather than replace one; the only triangle in src/ is the quiz's
 * SchoolTriangle, which drew three schools. Each candidate is
 * neutral: it says "a table of standings" and favours no school's shape.
 * 24 by 24, `currentColor`, decoration beside the label `School table`.
 */

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Three rows of different lengths: standings. */
export function StandingsIcon() {
  return (
    <svg {...base}>
      <path d="M4 6h16M4 12h11M4 18h7" />
    </svg>
  );
}

/** A ranked list: a dot and a line per row. */
export function RankedListIcon() {
  return (
    <svg {...base}>
      <circle cx="5" cy="6" r="1.4" fill="currentColor" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="5" cy="18" r="1.4" fill="currentColor" />
      <path d="M9.5 6H20M9.5 12H20M9.5 18H20" />
    </svg>
  );
}

/** A podium of three steps. */
export function PodiumIcon() {
  return (
    <svg {...base}>
      <path d="M3 20V13h6v7M9 20V8h6v12M15 20v-9h6v9M2 20h20" />
    </svg>
  );
}
