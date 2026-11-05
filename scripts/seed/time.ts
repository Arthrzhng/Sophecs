// Time helpers for the generator: local evening peaks, the launch curve,
// and timezone conversion through Intl, so a reader in London and one in
// Los Angeles are active at their own evenings, not at the same UTC hour.

import type { Rng } from "./rng";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// UK first, US second, then a spread. Shares, not counts.
export const TIMEZONES: [string, number][] = [
  ["Europe/London", 0.52],
  ["America/New_York", 0.13],
  ["America/Los_Angeles", 0.06],
  ["America/Chicago", 0.05],
  ["America/Toronto", 0.03],
  ["Europe/Dublin", 0.03],
  ["Europe/Berlin", 0.03],
  ["Asia/Kolkata", 0.03],
  ["Asia/Singapore", 0.03],
  ["Australia/Sydney", 0.03],
  ["Africa/Lagos", 0.02],
  ["Asia/Hong_Kong", 0.02],
  ["Europe/Paris", 0.02],
];

// Weight of each local hour: quiet overnight, a lunchtime rise, an evening
// peak around 8 to 9 pm.
const HOUR_WEIGHTS = [
  0.6, 0.3, 0.15, 0.1, 0.1, 0.15, 0.3, 0.6, 0.9, 1.0, 1.0, 1.1, 1.4, 1.3, 1.1, 1.2, 1.5, 1.9, 2.4, 2.8,
  3.0, 2.7, 2.0, 1.2,
];

// Monday is 1, Sunday 7: weekdays a little busier than weekends.
const WEEKDAY_WEIGHT: Record<number, number> = { 1: 1.1, 2: 1.1, 3: 1.1, 4: 1.05, 5: 0.95, 6: 0.85, 7: 0.9 };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Minutes the zone is ahead of UTC at instant `t`. */
export function tzOffsetMinutes(tz: string, t: number): number {
  const parts = Object.fromEntries(formatter(tz).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / MINUTE);
}

/** The UTC instant of a local wall-clock time on the local date containing `dayUtc`. */
export function localTime(tz: string, dayUtc: number, hour: number, minute: number): number {
  const offset = tzOffsetMinutes(tz, dayUtc + 12 * HOUR);
  const local = new Date(dayUtc + offset * MINUTE);
  const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, minute);
  // Correct once for a DST change between noon and the chosen hour.
  const guess = wall - offset * MINUTE;
  return wall - tzOffsetMinutes(tz, guess) * MINUTE;
}

export function weekday(t: number): number {
  const d = new Date(t).getUTCDay();
  return d === 0 ? 7 : d;
}

export function dayWeight(t: number): number {
  return WEEKDAY_WEIGHT[weekday(t)];
}

/** A local hour, evening-weighted, and a minute. */
export function localHourMinute(rng: Rng): [number, number] {
  const hour = rng.weighted(HOUR_WEIGHTS.map((w, h) => [h, w] as const));
  return [hour, rng.int(0, 59)];
}

/** An instant on the given UTC day at a plausible local hour, never after `latest`. */
export function activeTimeOn(rng: Rng, tz: string, dayUtc: number, earliest: number, latest: number): number | null {
  for (let i = 0; i < 12; i++) {
    const [h, m] = localHourMinute(rng);
    const t = localTime(tz, dayUtc, h, m) + rng.int(0, 59) * 1000;
    if (t >= earliest && t <= latest) return t;
  }
  return null;
}

export function startOfUtcDay(t: number): number {
  return Math.floor(t / DAY) * DAY;
}

export function iso(t: number): string {
  return new Date(t).toISOString();
}

export function utcDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
