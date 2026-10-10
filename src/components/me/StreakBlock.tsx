import { streakLine } from "@/lib/streak-copy";
import { liveStreak } from "@/lib/streak-week";

/**
 * The streak on the profile.
 *
 * Shown through `liveStreak`, the same rule Today's week strip uses: a run
 * last extended before yesterday is over, and reads 0. Nothing is written;
 * `profiles.streak` keeps whatever the judge left, and `applyStreakDay`
 * resets it the next time a qualifying argument lands.
 */
export function StreakBlock({
  streak,
  streakUpdatedOn,
  today,
}: {
  streak: number;
  /** profiles.streak_updated_on, a UTC date, or null. */
  streakUpdatedOn: string | null;
  /** Today in UTC, from the server. */
  today: string;
}) {
  const shown = liveStreak(streak, streakUpdatedOn, today);
  return (
    <div className="rounded-card border-2 border-rule bg-surface p-5">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Streak</p>
      <p className="mt-2 font-mono tabular text-xl font-extrabold text-ink">{shown}</p>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-mid">
        {streakLine(shown)}
      </p>
    </div>
  );
}
