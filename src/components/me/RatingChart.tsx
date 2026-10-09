import { chartScale, type RatingPoint } from "@/lib/rating-history";

/*
 * The plot box, in the SVG's own units.
 *
 * An SVG scales its text along with everything else, so the viewBox and
 * the figure's maximum width are chosen together to keep the rendered type
 * inside a readable band: the chart draws between about 287px inside a
 * phone's gutters and 352px at its cap, so a 13-unit label lands between
 * 12 and 14 real pixels at either end. A small viewBox stretched across a
 * wide column is what blows axis labels up to heading size.
 *
 * 352px is also about the size the mockup draws this figure at, so the cap
 * is not a compromise forced by the type.
 */
const W = 320;
const H = 180;
const LEFT = 42;
const RIGHT = 272;
const TOP = 32;
const BOTTOM = 130;

/**
 * Where a reader's rating stood, week by week. docs/daily-path-copy.md §9,
 * which replaces the mockup's illustrative triangle path.
 *
 * One series, so no legend: the heading names what is plotted. One value
 * labelled, on the last point, because a number on every point is chaos
 * and the table below carries the rest. Gridlines are hairlines a step off
 * the surface, which is as much as an axis is allowed to weigh.
 *
 * Blue, not a school colour: a rating is the reader's own and does not
 * belong to the school they argue for, and the only green in this product
 * means Stoicism.
 */
export function RatingChart({
  points,
  id = "rating-chart",
}: {
  points: RatingPoint[];
  id?: string;
}) {
  const titleId = `${id}-title`;

  return (
    <figure className="m-0 max-w-[22rem] rounded-panel border-2 border-rule bg-surface p-5">
      <figcaption className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        Where you stand, week by week
      </figcaption>

      {points.length === 0 ? (
        <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-ink-mid">
          Your rating appears here after your first judged argument.
        </p>
      ) : (
        <Plot points={points} titleId={titleId} />
      )}
    </figure>
  );
}

function Plot({ points, titleId }: { points: RatingPoint[]; titleId: string }) {
  const scale = chartScale(points.map((p) => p.rating));
  const span = scale.max - scale.min;

  const x = (i: number) =>
    points.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + (i * (RIGHT - LEFT)) / (points.length - 1);
  const y = (rating: number) => BOTTOM - ((rating - scale.min) / span) * (BOTTOM - TOP);

  const placed = points.map((p, i) => ({ ...p, x: x(i), y: y(p.rating) }));
  const first = placed[0];
  const last = placed[placed.length - 1];
  const line = placed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const summary =
    points.length === 1
      ? `Rating ${last.rating} in week ${last.week}.`
      : `Rating by week, from ${first.rating} in week ${first.week} to ${last.rating} in week ${last.week}.`;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} className="mt-3 w-full">
        <title id={titleId}>{summary}</title>

        {/* Hairlines, one step off the surface. Solid, never dashed. */}
        {scale.ticks.map((tick) => {
          const ty = y(tick);
          return (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={ty}
                y2={ty}
                stroke="var(--color-rule)"
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={ty + 4}
                textAnchor="end"
                className="font-mono tabular"
                fontSize="13"
                fill="var(--color-ink-mid)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {placed.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-correct)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* A 2px ring in the surface colour keeps a dot legible where it
            sits on the line or beside its neighbour. */}
        {placed.map((p) => (
          <circle
            key={`${p.year}-${p.week}`}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="var(--color-correct)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          >
            <title>
              Week {p.week}: rating {p.rating}
            </title>
          </circle>
        ))}

        {/* The endpoint only, in the margin kept clear for it on the right:
            beside its own dot, where it cannot be read as the value of the
            point before it. */}
        <text
          x={last.x + 10}
          y={last.y + 5}
          className="font-mono tabular"
          fontSize="15"
          fontWeight="800"
          fill="var(--color-ink)"
        >
          {last.rating}
        </text>

        {/* The ends, not every week, which would collide the moment a
            reader has more than a few. */}
        <text
          x={LEFT}
          y={BOTTOM + 20}
          textAnchor="middle"
          className="font-mono tabular"
          fontSize="13"
          fill="var(--color-ink-mid)"
        >
          {first.week}
        </text>
        {placed.length > 1 && (
          <text
            x={RIGHT}
            y={BOTTOM + 20}
            textAnchor="middle"
            className="font-mono tabular"
            fontSize="13"
            fill="var(--color-ink-mid)"
          >
            {last.week}
          </text>
        )}

        {/* Axis titles. Left-aligned above the plot rather than rotated
            beside it: a rotated title is harder to read and this one is a
            single word. */}
        <text x="0" y="13" fontSize="13" fontWeight="700" fill="var(--color-ink-mid)">
          Rating
        </text>
        <text
          x={(LEFT + RIGHT) / 2}
          y={BOTTOM + 44}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="var(--color-ink-mid)"
        >
          Week
        </text>
      </svg>

      {points.length === 1 && <p className="mt-2 text-sm text-ink-mid">One week so far.</p>}

      {/* The numbers, for anyone the picture does not reach. */}
      <table className="sr-only">
        <caption>Rating by week</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Rating</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={`${p.year}-${p.week}`}>
              <td>{p.week}</td>
              <td>{p.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
