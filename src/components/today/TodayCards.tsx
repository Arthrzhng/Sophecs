import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { streakLine, STREAK_PAUSED_LINE } from "@/lib/streak-copy";
import { liveStreak, streakDayLabel, streakWeek } from "@/lib/streak-week";
import type { SchoolId } from "@/lib/types";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-panel border-2 border-rule bg-surface p-5">{children}</section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">{children}</p>
  );
}

function Flame() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.6 3.2 3 4.7 4.6 6.9 1.2 1.6 1.9 3.3 1.9 5.1A6.5 6.5 0 0 1 12 21a6.5 6.5 0 0 1-6.5-6.5c0-2.4 1.2-4.2 2.6-5.4.2 1.6.9 2.7 2 3.3-.3-3.6.6-7 1.9-9.9z" />
    </svg>
  );
}

/**
 * The seven days of this week, lit where the run covers them.
 *
 * Lit is a filled disc and unlit is an open ring, so the two differ in
 * shape before they differ in colour. The letters are decoration: M and T
 * appear twice each and tell nobody which day they are, so each circle
 * carries the weekday in full for a screen reader and the letters are
 * hidden from it.
 *
 * Which days are lit is `streakWeek`, which is pure and tested. Nothing
 * here decides it.
 */
function StreakStrip({ streak, streakUpdatedOn, today }: {
  streak: number;
  streakUpdatedOn: string | null;
  today: string;
}) {
  const days = streakWeek(streak, streakUpdatedOn, today);
  return (
    <ul className="mt-4 flex justify-between gap-1">
      {days.map((day) => (
        <li key={day.date} className="flex flex-col items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-8 rounded-full border-2 ${
              day.lit
                ? "border-[color:var(--color-streak)] bg-[color:var(--color-streak)]"
                : "border-rule-strong"
            }`}
          />
          <span aria-hidden="true" className="text-xs font-bold text-ink-mid">
            {day.label}
          </span>
          <span className="sr-only">{streakDayLabel(day)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The streak, said honestly.
 *
 * While judging is paused the number, and the week with it, are hidden
 * rather than shown as a zero that can never move: a streak day needs a
 * judged argument, so with the judge off the figure is not a score, it is
 * an artefact of the pause. The flame only burns on a streak that is
 * actually running.
 */
export function StreakCard({
  streak,
  streakUpdatedOn,
  today,
  paused,
}: {
  /** profiles.streak, as the judge last wrote it. Shown through liveStreak. */
  streak: number;
  /** profiles.streak_updated_on, a UTC date, or null. */
  streakUpdatedOn: string | null;
  /** Today in UTC, from the server, so the week cannot drift by timezone. */
  today: string;
  paused: boolean;
}) {
  // A run that ended before yesterday reads 0, here and on /me, by the same
  // rule that leaves the week empty. A flame over a 4 above seven unlit
  // circles was the display reporting a streak the reader no longer has.
  const shown = liveStreak(streak, streakUpdatedOn, today);
  return (
    <Card>
      <Eyebrow>Streak</Eyebrow>
      {!paused && (
        <>
          <p className="mt-3 flex items-center gap-3">
            <span
              className={shown > 0 ? "flick inline-flex" : "inline-flex"}
              style={{ color: shown > 0 ? "var(--color-streak)" : "var(--color-rule-strong)" }}
            >
              <Flame />
            </span>
            <span className="font-mono tabular text-xl font-extrabold text-ink">{shown}</span>
          </p>
          <StreakStrip streak={streak} streakUpdatedOn={streakUpdatedOn} today={today} />
        </>
      )}
      <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-ink-mid">
        {paused ? STREAK_PAUSED_LINE : streakLine(shown)}
      </p>
    </Card>
  );
}

// Three schools, so three places. Written out rather than "1st": the
// rating beside it is a number and is set in mono, and two numerals in
// adjacent lines saying different kinds of thing read as a table of
// figures. Ties share a rank, so the third place can be vacant, but no
// school can ever rank below third.
const PLACES = ["First", "Second", "Third"];

/** The reader's school, its rating, where it stands, and the way to the table. */
export function SchoolCard({
  school,
  oneLine,
  elo,
  rank,
}: {
  school: SchoolId;
  oneLine: string;
  /** profiles.elo, the reader's own rating, not the school's. */
  elo: number;
  /** The school's place on this week's table, or null with nothing judged. */
  rank: number | null;
}) {
  const place = rank != null ? PLACES[rank - 1] : null;
  return (
    <Card>
      <Eyebrow>Your school</Eyebrow>
      <p
        className="mt-2 text-lg font-extrabold tracking-tight"
        style={{ color: `var(--color-${school === "virtue-ethics" ? "virtue" : school === "utilitarianism" ? "utilitarian" : "stoic"})` }}
      >
        {SCHOOL_COLORS[school].name}
      </p>
      <p className="mt-2 max-w-[34ch] font-serif text-base leading-relaxed text-ink-mid">
        {oneLine}
      </p>
      <p className="mt-3 text-sm text-ink">
        Rating <span className="font-mono tabular font-bold">{Math.round(elo)}</span>
      </p>
      <p className="mt-1 text-sm text-ink-mid">
        {place ? `${place} on the table this week` : "Not ranked yet this week"}
      </p>
      <p className="mt-3">
        <Link
          href="/table"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          See the school table
        </Link>
      </p>
    </Card>
  );
}
