// Pure — deliberately free of `server-only` and of any filesystem or
// database access, so it is unit-testable and usable from either side.

export interface WeeklyMotionCandidate {
  slug: string;
  title: string;
  sort: number;
}

// ISO-8601 week number. A week belongs to the year containing its Thursday,
// which is why "days since Jan 1, divided by 7" gives the wrong answer
// across a year boundary: 2027-01-01 is a Friday and belongs to week 53 of
// 2026, not week 1 of 2027.
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO days run Mon=1..Sun=7; JS gives Sun=0.
  const dayNumber = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// Deterministic and forgiving: the same motion for everyone all week, no
// column, no cron, no penalty for missing one. Rotates through the active
// topics in `sort` order.
export function getWeeklyMotion<T extends WeeklyMotionCandidate>(
  activeTopics: T[],
  now: Date = new Date()
): T | null {
  if (activeTopics.length === 0) return null;
  const ordered = [...activeTopics].sort((a, b) => a.sort - b.sort);
  return ordered[isoWeekNumber(now) % ordered.length];
}
