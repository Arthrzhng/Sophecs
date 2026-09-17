// The shape of a case and the two pure helpers that read it.
//
// Split out of cases.ts, which is `server-only` because it queries
// Supabase: CaseTicks renders inside TopicList, and TopicList became a
// client component when the arena list gained its filters. Importing
// CASE_STEPS from there would pull the whole query module into the browser
// bundle — the same reason weekly-motion, share-line and lesson-chunks are
// their own files. cases.ts re-exports all three, so every existing import
// keeps working.

// The four states of a case, in order. Computed from what the user has
// actually done, never stored: every one of these is already a row
// somewhere, and a denormalised `case_state` column would be a fifth place
// to keep in sync with the other four.
export interface CaseState {
  read: boolean;
  argued: boolean;
  answered: boolean;
  closed: boolean;
}

export const CASE_STEPS = ["Read", "Argued", "Answered", "Closed"] as const;

export function caseTicks(state: CaseState): boolean[] {
  return [state.read, state.argued, state.answered, state.closed];
}
