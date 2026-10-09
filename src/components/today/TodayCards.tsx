import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { streakLine, STREAK_PAUSED_LINE } from "@/lib/streak-copy";
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
 * The streak, said honestly.
 *
 * While judging is paused the number is hidden rather than shown as a zero
 * that can never move: a streak day needs a judged argument, so with the
 * judge off the figure is not a score, it is an artefact of the pause.
 * The flame only burns on a streak that is actually running.
 */
export function StreakCard({ streak, paused }: { streak: number; paused: boolean }) {
  return (
    <Card>
      <Eyebrow>Streak</Eyebrow>
      {!paused && (
        <p className="mt-3 flex items-center gap-3">
          <span
            className={streak > 0 ? "flick inline-flex" : "inline-flex"}
            style={{ color: streak > 0 ? "var(--color-streak)" : "var(--color-rule-strong)" }}
          >
            <Flame />
          </span>
          <span className="font-mono tabular text-xl font-extrabold text-ink">{streak}</span>
        </p>
      )}
      <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-ink-mid">
        {paused ? STREAK_PAUSED_LINE : streakLine(streak)}
      </p>
    </Card>
  );
}

/** The reader's school, its one line, and the way to the table. */
export function SchoolCard({ school, oneLine }: { school: SchoolId; oneLine: string }) {
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

export function LessonsCard() {
  return (
    <Card>
      <Eyebrow>Lessons</Eyebrow>
      <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-mid">
        A longer reading for each school, and twelve short passages: one before
        and one after each motion.
      </p>
      <p className="mt-3">
        <Link
          href="/lessons"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Open the lessons
        </Link>
      </p>
    </Card>
  );
}
