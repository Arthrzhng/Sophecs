/**
 * The two-axis map of schools (Stage 4 of the brief of 2026-11-03). Quiz v2
 * draws it on a SIX_SCHOOLS build: beside each question, on the result
 * page and on a v2 result's shared page (docs/stage5-plan.md, step 4).
 * Production, without the flag, does not render it.
 *
 * One component for both places the brief puts it. The quiz preview passes
 * `preview`, which draws the dashed "where this answer moves you" ring and
 * the dashed path to it from where the reader stands. The Profile history
 * passes `history`, the reader's earlier positions, joined in order.
 *
 * Positions are on the map's own scale, -1 to 1 on each axis, the scale
 * `docs/quiz-v2.md` uses. Every school sits at the same distance from the
 * middle, at its angle, which is what makes "nearest dot" and "the school
 * you lean towards" the same thing.
 *
 * Pure SVG with no state, so a server component can render it, and every
 * colour arrives as a prop: a token reference for a live school, a
 * candidate for a draft one.
 */

export interface MapSchool {
  id: string;
  name: string;
  /** Degrees anticlockwise from "people through each other". */
  angle: number;
  /** A CSS colour: `var(--color-stoic)` for a live school. */
  colour: string;
}

export interface MapPoint {
  x: number;
  y: number;
}

// Wide enough for a school's name beside its dot on either side of the
// ring. The axis names sit outside the drawing, in HTML, so they wrap at
// a phone's width instead of colliding with the dots.
const W = 420;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const R = 118;

const px = (p: MapPoint) => ({ cx: CX + p.x * R, cy: CY - p.y * R });

export function SchoolMap({
  title,
  schools,
  axes,
  reader,
  preview,
  history,
  caption,
  whose = "your",
}: {
  title: string;
  schools: MapSchool[];
  axes: { x: [string, string]; y: [string, string] };
  reader?: MapPoint;
  preview?: MapPoint;
  history?: MapPoint[];
  caption?: string;
  /**
   * Whose answers the dot shows: the reader's own, or, on a shared result
   * (/r/<id>), someone else's, where the description says "they" (Arthur,
   * 2026-11-07, Gate 4 item 8).
   */
  whose?: "your" | "their";
}) {
  const titleId = `map-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const descId = `${titleId}-desc`;
  // What role="img" hides from a screen reader: where the schools sit and
  // what the marks show.
  const description = [
    `The schools sit on a ring, in this order going round: ${schools
      .slice()
      .sort((a, b) => a.angle - b.angle)
      .map((s) => s.name)
      .join(", ")}.`,
    reader ? `A filled dot marks where ${whose === "their" ? "they stand" : "you stand"}.` : "",
    preview ? "A dashed ring marks where this answer would move you." : "",
    history && history.length > 1 ? "A line joins your earlier positions in order." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <figure className="m-0 max-w-[460px]">
      <p className="text-center text-xs font-bold text-ink-mid">{axes.y[1]}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="mt-1 w-full"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>

        {/* The ring the schools sit on, and the two axes. */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-rule)" strokeWidth={2} />
        <line x1={CX - R - 12} y1={CY} x2={CX + R + 12} y2={CY} stroke="var(--color-rule-strong)" strokeWidth={1.5} />
        <line x1={CX} y1={CY - R - 12} x2={CX} y2={CY + R + 12} stroke="var(--color-rule-strong)" strokeWidth={1.5} />

        {schools.map((s) => {
          const a = (s.angle * Math.PI) / 180;
          const { cx, cy } = px({ x: Math.cos(a), y: Math.sin(a) });
          const right = Math.cos(a) >= 0;
          return (
            <g key={s.id}>
              <circle cx={cx} cy={cy} r={9} fill={s.colour} stroke="var(--color-surface)" strokeWidth={2.5} />
              <text
                x={cx + (right ? 13 : -13)}
                y={cy + 4}
                textAnchor={right ? "start" : "end"}
                className="fill-ink text-xs font-bold"
              >
                {s.name}
              </text>
            </g>
          );
        })}

        {history && history.length > 1 && (
          <polyline
            points={history.map((p) => `${px(p).cx},${px(p).cy}`).join(" ")}
            fill="none"
            stroke="var(--color-ink-mid)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {history?.slice(0, -1).map((p, i) => (
          <circle key={i} {...px(p)} r={3.5} fill="var(--color-ink-mid)" />
        ))}

        {reader && preview && (
          <>
            <line
              x1={px(reader).cx}
              y1={px(reader).cy}
              x2={px(preview).cx}
              y2={px(preview).cy}
              stroke="var(--color-ink)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <circle {...px(preview)} r={11} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeDasharray="4 3" />
          </>
        )}
        {reader && <circle {...px(reader)} r={6.5} fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth={2} />}
      </svg>
      <p className="mt-1 text-center text-xs font-bold text-ink-mid">{axes.y[0]}</p>
      <p className="mt-2 flex justify-between gap-4 text-xs font-bold text-ink-mid">
        <span>&larr; {axes.x[0]}</span>
        <span className="text-right">{axes.x[1]} &rarr;</span>
      </p>
      {caption && <figcaption className="mt-3 text-sm font-bold text-ink">{caption}</figcaption>}
    </figure>
  );
}
