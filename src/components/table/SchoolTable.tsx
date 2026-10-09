import { SCHOOL_COLORS } from "@/lib/school-colors";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
import { joinedLeftLabel, type SchoolTableRow } from "@/lib/school-table";
import type { SchoolId } from "@/lib/types";

/** A value the week has not produced. Same marker the verdict uses. */
const NOTHING = "—";

export interface SchoolTableProps {
  week: number;
  rows: SchoolTableRow[];
  /** The reader's school, so their row is marked. Null when signed out. */
  yourSchool: SchoolId | null;
  /** §8's "Your line". Null when there is no school to write it about. */
  yourLine: string | null;
  /** True when no argument has been judged this week. */
  emptyWeek: boolean;
  /** True when the kill switch is on for this reader. */
  paused: boolean;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col text-right">
      <span className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        {label}
      </span>
      <strong className="font-mono tabular text-base text-ink">{children}</strong>
    </span>
  );
}

/**
 * How each school argued this week.
 *
 * Read-only and entirely derived: the averages are computed from the
 * week's judged arguments and the joined/left counts from school_history,
 * so there is no standings table to keep in step and nothing to migrate.
 *
 * Rows are cards with a label on every value rather than a grid under one
 * header. Three rows and five values do not need table semantics to be
 * read, and labelling each value is what lets the row survive a phone.
 *
 * No names, here or anywhere: a school's row is the sum of a week, and the
 * only person it ever identifies is the reader, to the reader.
 */
export function SchoolTable({
  week,
  rows,
  yourSchool,
  yourLine,
  emptyWeek,
  paused,
}: SchoolTableProps) {
  return (
    <div data-daily-path>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">School table</h1>
          <p className="mt-2 max-w-[60ch] text-base leading-relaxed text-ink-mid">
            How each school argued this week. Fidelity is the judge&apos;s 0&ndash;10 mark
            for arguing the way the school reasons, averaged across every judged
            argument.
          </p>
        </div>
        <span className="rounded-card border-2 border-rule bg-surface px-4 py-2 text-sm font-extrabold text-ink">
          Week <span className="font-mono tabular">{week}</span> &middot; closes Sunday,
          midnight UTC
        </span>
      </div>

      {emptyWeek && (
        <p className="mt-6 rounded-card border-2 border-rule bg-surface px-5 py-4 text-sm leading-relaxed text-ink-mid">
          No judged arguments yet this week. The table fills in as they arrive.
          {paused && (
            <>
              {" "}
              Judging is paused while we check the quality of the verdicts.
            </>
          )}
        </p>
      )}

      {/* The mockup scrolls this sideways below 640px. It wraps instead:
          the three values drop to a second line and the row keeps all of
          its data on screen, which a horizontal scrollbar inside a page
          is the usual way to lose. `sm:contents` dissolves the wrapper
          again once there is room for one line. */}
      <div className="mt-6">
        <ol className="flex flex-col gap-3">
          {rows.map((row) => {
            const mine = row.school === yourSchool;
            const tone = SCHOOL_CHUNKY[row.school];
            return (
              <li
                key={row.school}
                className={`chunky grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-panel bg-surface px-5 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_repeat(3,minmax(5.5rem,auto))] ${
                  mine ? "border-[3px]" : "border-2 border-rule-strong"
                }`}
                style={
                  mine
                    ? { ...shade(tone.shade), borderColor: tone.bg }
                    : shade("var(--color-rule-strong)")
                }
              >
                <span className="text-center">
                  <span className="sr-only">
                    {row.rank == null ? "Not ranked yet" : `Rank ${row.rank}`}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono tabular text-lg font-extrabold text-ink"
                  >
                    {row.rank ?? NOTHING}
                  </span>
                </span>

                <span className="flex min-w-0 flex-col">
                  <span className="inline-flex items-center gap-3 text-base font-extrabold text-ink">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ background: tone.bg }}
                    />
                    {SCHOOL_COLORS[row.school].name}
                  </span>
                  {mine && (
                    <span
                      className="mt-0.5 text-xs font-extrabold tracking-widest uppercase"
                      style={{ color: tone.bg }}
                    >
                      Your school
                    </span>
                  )}
                </span>

                <span className="col-span-2 flex items-start justify-between gap-4 sm:contents">
                  <Cell label="Avg fidelity">
                    {row.avgFidelity == null ? NOTHING : row.avgFidelity.toFixed(1)}
                  </Cell>
                  <Cell label="Arguments">{row.arguments}</Cell>
                  <Cell label="Joined / left">
                    <span aria-hidden="true">
                      +{row.joined} / &minus;{row.left}
                    </span>
                    <span className="sr-only">{joinedLeftLabel(row.joined, row.left)}</span>
                  </Cell>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(18rem,100%),1fr))] gap-4">
        {yourLine && (
          <section className="rounded-card border-2 border-rule bg-surface px-5 py-4">
            <h2 className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
              Your week
            </h2>
            <p className="mt-2 text-base leading-relaxed text-ink">{yourLine}</p>
          </section>
        )}
        <section className="rounded-card border-2 border-rule bg-surface px-5 py-4">
          <h2 className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
            Joined and left
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mid">
            Joined and left count people who retook the quiz and changed school. No
            names are shown, here or anywhere else.
          </p>
        </section>
      </div>
    </div>
  );
}
