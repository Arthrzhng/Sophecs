import { isoWeekNumber } from "./weekly-motion";
import { SCHOOL_IDS, type SchoolId } from "./types";

/**
 * The school table's arithmetic, kept pure so it is testable without a
 * database. Everything here is read-only and derived: no column, no
 * migration, no stored standings. See docs/daily-path-copy.md §8.
 */

/** One judged argument's contribution, as read off a debates row. */
export interface JudgedArgument {
  school: SchoolId;
  fidelity: number | null;
}

/** One entry of profiles.school_history, as written by retakeQuizSchool. */
export interface SchoolChange {
  from: SchoolId | null;
  to: SchoolId;
  at: string;
}

export interface SchoolTableRow {
  /**
   * Null for a school with no average to be ranked on. Rank is by average
   * fidelity, so a school that has none has no place in the order: with
   * nothing judged all week, "1, 1, 1" reads as a fault rather than as
   * nothing having happened yet.
   */
  rank: number | null;
  school: SchoolId;
  /** Null when the school has no judged argument with a fidelity mark. */
  avgFidelity: number | null;
  arguments: number;
  joined: number;
  left: number;
}

/**
 * The ISO week containing `now`: Monday 00:00 UTC up to, but not
 * including, the following Monday.
 *
 * The same week the weekly motion runs on, so "this week" on the table and
 * "this week's motion" on Today can never mean different spans.
 */
export function isoWeekRange(now: Date): { start: Date; end: Date; week: number } {
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1))
  );
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start, end, week: isoWeekNumber(now) };
}

/**
 * Who joined and who left each school inside the window.
 *
 * A retake that lands somewhere new is one person leaving one school and
 * joining another, which is why a single entry increments two counters. The
 * first quiz has `from: null` and so only ever joins.
 */
export function schoolChanges(
  entries: SchoolChange[],
  start: Date,
  end: Date
): Record<SchoolId, { joined: number; left: number }> {
  const counts = Object.fromEntries(
    SCHOOL_IDS.map((s) => [s, { joined: 0, left: 0 }])
  ) as Record<SchoolId, { joined: number; left: number }>;

  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (!Number.isFinite(at) || at < start.getTime() || at >= end.getTime()) continue;
    if (counts[entry.to]) counts[entry.to].joined += 1;
    if (entry.from && counts[entry.from]) counts[entry.from].left += 1;
  }
  return counts;
}

/**
 * The ranked table.
 *
 * Rank is by average fidelity, then by number of arguments, and ties share
 * a rank: two schools level on both are both second, and the next is
 * fourth. A school with nothing judged has no average and sorts last
 * whatever its argument count, because an empty average is not a zero.
 */
export function rankSchools(
  judged: JudgedArgument[],
  changes: Record<SchoolId, { joined: number; left: number }>
): SchoolTableRow[] {
  const tallies = SCHOOL_IDS.map((school) => {
    const marks = judged
      .filter((a) => a.school === school && a.fidelity != null)
      .map((a) => a.fidelity as number);
    return {
      school,
      avgFidelity: marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null,
      // Every judged argument counts, including one the judge gave no
      // fidelity mark: it was still argued for that school this week.
      arguments: judged.filter((a) => a.school === school).length,
      joined: changes[school]?.joined ?? 0,
      left: changes[school]?.left ?? 0,
    };
  });

  const ordered = [...tallies].sort((a, b) => {
    if (a.avgFidelity == null && b.avgFidelity == null) return b.arguments - a.arguments;
    if (a.avgFidelity == null) return 1;
    if (b.avgFidelity == null) return -1;
    return b.avgFidelity - a.avgFidelity || b.arguments - a.arguments;
  });

  const key = (t: (typeof tallies)[number]) => `${t.avgFidelity}:${t.arguments}`;
  let rank = 0;
  let previous = "";
  return ordered.map((tally, i) => {
    if (tally.avgFidelity == null) return { rank: null, ...tally };
    const k = key(tally);
    if (k !== previous) {
      rank = i + 1;
      previous = k;
    }
    return { rank, ...tally };
  });
}

/**
 * Whether one debate counts towards its school's row.
 *
 * Originals only, judged, and inside the week the table is showing. A
 * revision is a second attempt at the same motion after feedback: it does
 * not move the reader's rating, so it does not move their school's row
 * either, and counting it would let one motion be argued twice.
 *
 * Shared by the table's query and the line on the verdict that reports it,
 * so the two cannot say different things about the same argument.
 */
export function countsOnTable(
  debate: { kind: string | null; rejected: boolean; createdAt: string | null },
  now: Date = new Date()
): boolean {
  if (debate.kind !== "original" || debate.rejected || !debate.createdAt) return false;
  const at = new Date(debate.createdAt).getTime();
  if (!Number.isFinite(at)) return false;
  const { start, end } = isoWeekRange(now);
  return at >= start.getTime() && at < end.getTime();
}

/** §8's "Your line". `once` rather than "1 times". */
export function yourTableLine(count: number, schoolName: string): string {
  if (count <= 0) return `You haven't argued for ${schoolName} this week yet.`;
  const times = count === 1 ? "once" : `${count} times`;
  return `You argued ${times} for ${schoolName} this week.`;
}

/** §8's joined/left cell, and the sentence a screen reader gets instead. */
export function joinedLeftLabel(joined: number, left: number): string {
  return `${joined} joined, ${left} left this week`;
}
