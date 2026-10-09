import { isoWeekNumber } from "./weekly-motion";

/**
 * The profile chart's data: where a reader's rating stood at the end of
 * each week they argued in. Pure, so the chart can be tested and drawn
 * from fixtures without a database. See docs/daily-path-copy.md §9.
 */

export interface RatingPoint {
  /** ISO week-numbering year, which is not always the calendar year. */
  year: number;
  week: number;
  rating: number;
}

export interface JudgedRating {
  created_at: string;
  elo_after: number | null;
}

/**
 * The ISO week-numbering year: the year containing the week's Thursday.
 * 2027-01-01 is a Friday and belongs to week 53 of 2026, so the calendar
 * year would put it in the wrong bucket and sort it ahead of the week it
 * actually follows.
 */
export function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  return d.getUTCFullYear();
}

/**
 * One point per week argued in, carrying the rating that week ended on.
 *
 * The last judged argument of a week is the one that sets the point: the
 * chart answers "where did I stand", not "every move I made". Rows without
 * a rating are skipped rather than plotted as a gap, because a rejected
 * argument did not move the rating at all.
 */
export function ratingByWeek(rows: JudgedRating[]): RatingPoint[] {
  const byWeek = new Map<string, { at: number; point: RatingPoint }>();

  for (const row of rows) {
    if (row.elo_after == null) continue;
    const date = new Date(row.created_at);
    const at = date.getTime();
    if (!Number.isFinite(at)) continue;

    const year = isoWeekYear(date);
    const week = isoWeekNumber(date);
    const key = `${year}-${String(week).padStart(2, "0")}`;
    const existing = byWeek.get(key);
    if (!existing || at > existing.at) {
      byWeek.set(key, { at, point: { year, week, rating: row.elo_after } });
    }
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => v.point);
}

export interface ChartScale {
  min: number;
  max: number;
  /** The gridline values, low to high. */
  ticks: number[];
}

/**
 * A y domain with round numbers on it.
 *
 * Padded by a fifth at each end so no point sits on a gridline, then
 * snapped outward to a multiple of ten, with a floor on the span so a
 * reader whose rating moved by two points does not get a chart that makes
 * it look like fifty. Three ticks: the two ends and the middle, which is
 * as many as a chart this size can label without collisions.
 */
export function chartScale(values: number[], minimumSpan = 40): ChartScale {
  if (values.length === 0) return { min: 0, max: minimumSpan, ticks: [0, minimumSpan] };

  const low = Math.min(...values);
  const high = Math.max(...values);
  const centre = (low + high) / 2;
  const span = Math.max((high - low) * 1.4, minimumSpan);

  const min = Math.floor((centre - span / 2) / 10) * 10;
  const max = Math.ceil((centre + span / 2) / 10) * 10;
  const mid = Math.round((min + max) / 2 / 10) * 10;

  const ticks = mid > min && mid < max ? [min, mid, max] : [min, max];
  return { min, max, ticks };
}
