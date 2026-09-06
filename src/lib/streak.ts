// A streak day is a UTC date with at least one judged debate scoring 40 or
// more. Consecutive days extend; a gap resets. Computed opportunistically
// at judge time (there's no scheduled job in this phase) — see
// docs/decisions.md for what that means for a stale display.
export const STREAK_THRESHOLD = 40;

export function isStreakEligible(score: number): boolean {
  return score >= STREAK_THRESHOLD;
}

export interface StreakState {
  streak: number;
  streakUpdatedOn: string | null; // YYYY-MM-DD, UTC
}

export type StreakChange = "extended" | "reset" | "unchanged";

export interface StreakResult extends StreakState {
  change: StreakChange;
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// today defaults to the real UTC date; passed explicitly in tests.
export function applyStreakDay(state: StreakState, today: string = todayUTC()): StreakResult {
  if (state.streakUpdatedOn === today) {
    // Already counted a qualifying debate today — a second one doesn't
    // extend the streak further.
    return { ...state, change: "unchanged" };
  }

  if (state.streakUpdatedOn && daysBetween(state.streakUpdatedOn, today) === 1) {
    return { streak: state.streak + 1, streakUpdatedOn: today, change: "extended" };
  }

  // First-ever streak day, or a gap of more than one day — either way,
  // today starts (or restarts) the count at 1.
  return { streak: 1, streakUpdatedOn: today, change: state.streak > 0 ? "reset" : "extended" };
}
