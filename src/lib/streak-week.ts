import { isoWeekRange } from "./school-table";

/**
 * The seven circles above the streak line: which days of the current week
 * are part of the run.
 *
 * Display only. The streak rules themselves live in streak.ts and are not
 * touched here: this reads `streak` and `streak_updated_on` exactly as the
 * judge left them and says which squares to fill.
 *
 * The week is the ISO week, UTC, taken from the same `isoWeekRange` the
 * school table uses, so "this week" cannot come to mean two different spans
 * on two screens.
 */
export interface StreakWeekDay {
  /** YYYY-MM-DD, UTC. */
  date: string;
  /** The letter under the circle. */
  label: string;
  /** The weekday in full, for the screen reader. */
  weekday: string;
  lit: boolean;
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY = 86_400_000;

function dayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The dates of the run, as far back as a week of circles could show.
 *
 * A streak is only live if it was last extended today or yesterday. Stored
 * numbers go stale: the count is written opportunistically at judge time
 * and nothing clears it when a day is missed, so a reader who last argued
 * on Tuesday still has `streak: 4` on Friday. Lighting four circles for it
 * would be the display inventing a run that has already ended.
 *
 * Seven steps back is always enough, because the run ends today or
 * yesterday and the strip is seven days wide: anything further back falls
 * outside the week whatever the stored count says.
 */
function runDates(streak: number, streakUpdatedOn: string | null, today: string): Set<string> {
  const dates = new Set<string>();
  if (!streakUpdatedOn || streak <= 0) return dates;

  const end = Date.parse(`${streakUpdatedOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return dates;

  // Today or yesterday, and nothing else. A date in the future is bad data
  // rather than a streak, and it fails this the same way a stale one does.
  const gap = Math.round((now - end) / DAY);
  if (gap !== 0 && gap !== 1) return dates;

  for (let i = 0; i < Math.min(streak, 7); i += 1) dates.add(dayString(end - i * DAY));
  return dates;
}

/**
 * Monday to Sunday of the week containing `today`, each marked lit or not.
 *
 * `today` is a UTC date string so the caller decides what day it is; the
 * page passes `todayUTC()` and the tests pass a fixed date.
 */
export function streakWeek(
  streak: number,
  streakUpdatedOn: string | null,
  today: string
): StreakWeekDay[] {
  const { start } = isoWeekRange(new Date(`${today}T00:00:00Z`));
  const run = runDates(streak, streakUpdatedOn, today);

  return LABELS.map((label, i) => {
    const date = dayString(start.getTime() + i * DAY);
    return { date, label, weekday: WEEKDAYS[i], lit: run.has(date) };
  });
}

/** What a screen reader hears for one circle. */
export function streakDayLabel(day: StreakWeekDay): string {
  return day.lit ? `${day.weekday}, streak day` : day.weekday;
}
