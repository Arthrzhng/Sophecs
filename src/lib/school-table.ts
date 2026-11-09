import { isoWeekNumber } from "./weekly-motion";
import { SHOWN_SCHOOL_IDS, type SchoolId } from "./types";

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

/**
 * Joiners and leavers per school over the table's seven days.
 *
 * Sparse over `SchoolId`: a school with no movement has no entry, which
 * reads the same as a zero. That is what lets a caller with no interest in
 * the columns pass `{}` instead of building a zero for every school.
 */
export type SchoolChangeCounts = Partial<
  Record<SchoolId, { joined: number; left: number }>
>;

/** One entry of profiles.school_history, as written by retakeQuizSchool. */
export interface SchoolChange {
  from: SchoolId | null;
  to: SchoolId;
  at: string;
}

/**
 * A school is ranked once it has this many judged original arguments in
 * the table's seven days (Arthur's ruling (e)5 of 2026-11-05, for a week;
 * the seven days are his of 2026-11-09, item 9). Below it, an average of
 * a handful reads as a standing it has not earned, so the row has no rank
 * and says how many it has (docs/daily-path-copy.md, "School table, a
 * school not yet ranked").
 *
 * On SIX_SCHOOLS builds only: Checkpoint B asked about the preview's
 * table, and the ruling answered that. Arthur ruled on 2026-11-06 that the
 * live table takes it at launch, with the flag, and not before, so a build
 * without the flag ranks as before, every school with an average, and the
 * launch applies it by turning the flag on (docs/stage5-plan.md, step 6).
 */
export const RANK_MIN_ARGUMENTS = 20;

/** Whether this build holds a school to RANK_MIN_ARGUMENTS. */
export function rankThresholdApplies(): boolean {
  return process.env.SIX_SCHOOLS === "1";
}

/**
 * The line under a school not ranked for want of arguments. "It has", not
 * "so far": over seven days that roll, the count can fall as well as rise.
 */
export function unrankedNote(argumentCount: number): string {
  return `Ranked once it has ${RANK_MIN_ARGUMENTS} judged original arguments in the last seven days. It has ${argumentCount}.`;
}

export interface SchoolTableRow {
  /**
   * Null for a school not yet ranked: one with no average to be ranked
   * on, or, where rankThresholdApplies(), with fewer than
   * RANK_MIN_ARGUMENTS judged original arguments in the table's seven days. Rank is by average fidelity, so a school that
   * has none has no place in the order: with nothing judged in seven days,
   * "1, 1, 1" reads as a fault rather than as nothing having happened yet.
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
 * including, the following Monday. The week the weekly motion and the
 * streak's week run on (src/lib/streak-week.ts). The table no longer
 * counts it: it counts the last seven days (tableWindow).
 */
export function isoWeekRange(now: Date): { start: Date; end: Date; week: number } {
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1))
  );
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start, end, week: isoWeekNumber(now) };
}

/** How many days the table counts, up to now. */
export const TABLE_DAYS = 7;
// A row is dated by the database's clock, which may run a little ahead of
// the function's; the window's end allows for that.
const CLOCK_ALLOWANCE_MS = 60_000;

/**
 * The span the school table counts: the last seven days, up to now
 * (Arthur, 2026-11-09, item 9: "the table counts the last seven days, so
 * all six stay ranked every day"). A week from Monday holds two days' or
 * fewer arguments on a Tuesday, so no school is ranked early in the week;
 * seven days that roll always hold seven.
 *
 * Shared by the table, Today's place on it and the verdict's line, so the
 * three cannot count different spans.
 */
export function tableWindow(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(now.getTime() - TABLE_DAYS * 86_400_000),
    end: new Date(now.getTime() + CLOCK_ALLOWANCE_MS),
  };
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
): SchoolChangeCounts {
  const counts = Object.fromEntries(
    SHOWN_SCHOOL_IDS.map((s) => [s, { joined: 0, left: 0 }])
  ) as SchoolChangeCounts;

  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (!Number.isFinite(at) || at < start.getTime() || at >= end.getTime()) continue;
    const joining = counts[entry.to];
    if (joining) joining.joined += 1;
    const leaving = entry.from ? counts[entry.from] : undefined;
    if (leaving) leaving.left += 1;
  }
  return counts;
}

/**
 * The ranked table.
 *
 * Rank is by average fidelity, then by number of arguments, and ties share
 * a rank: two schools level on both are both second, and the next is
 * fourth. Only a school with an average is ranked, and on a SIX_SCHOOLS
 * build only one with RANK_MIN_ARGUMENTS judged original arguments as
 * well; the rest follow, unranked, by argument count.
 * A school with nothing judged has no average and is never ranked,
 * because an empty average is not a zero.
 */
export function rankSchools(
  judged: JudgedArgument[],
  changes: SchoolChangeCounts
): SchoolTableRow[] {
  // A row per school this build shows, so a SIX_SCHOOLS build has six,
  // the three new ones unranked until someone argues for them.
  const tallies = SHOWN_SCHOOL_IDS.map((school) => {
    const marks = judged
      .filter((a) => a.school === school && a.fidelity != null)
      .map((a) => a.fidelity as number);
    return {
      school,
      avgFidelity: marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null,
      // Every judged argument counts, including one the judge gave no
      // fidelity mark: it was still argued for that school in the window.
      arguments: judged.filter((a) => a.school === school).length,
      joined: changes[school]?.joined ?? 0,
      left: changes[school]?.left ?? 0,
    };
  });

  const minimum = rankThresholdApplies() ? RANK_MIN_ARGUMENTS : 1;
  const rankable = (t: (typeof tallies)[number]) =>
    t.avgFidelity != null && t.arguments >= minimum;
  const ordered = [...tallies].sort((a, b) => {
    if (!rankable(a) && !rankable(b)) return b.arguments - a.arguments;
    if (!rankable(a)) return 1;
    if (!rankable(b)) return -1;
    return (b.avgFidelity as number) - (a.avgFidelity as number) || b.arguments - a.arguments;
  });

  const key = (t: (typeof tallies)[number]) => `${t.avgFidelity}:${t.arguments}`;
  let rank = 0;
  let previous = "";
  return ordered.map((tally, i) => {
    if (!rankable(tally)) return { rank: null, ...tally };
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
 * Originals only, judged, and inside the seven days the table counts. A
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
  const { start, end } = tableWindow(now);
  return at >= start.getTime() && at < end.getTime();
}

/** §8's "Your line". `once` rather than "1 times". */
export function yourTableLine(count: number, schoolName: string): string {
  if (count <= 0) return `You haven't argued for ${schoolName} in the last seven days.`;
  const times = count === 1 ? "once" : `${count} times`;
  return `You argued ${times} for ${schoolName} in the last seven days.`;
}

/** §8's joined/left cell, and the sentence a screen reader gets instead. */
export function joinedLeftLabel(joined: number, left: number): string {
  return `${joined} joined, ${left} left in the last seven days`;
}
