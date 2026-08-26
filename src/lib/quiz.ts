import type { QuizOption, SchoolId } from "./types";
import { SCHOOL_IDS } from "./schools";

export interface QuizOutcome {
  pct_stoic: number;
  pct_util: number;
  pct_virtue: number;
  assigned_school_id: SchoolId;
}

// Each chosen option scores one point toward its school; the result is the
// percentage split, highest wins. Ties break in SCHOOL_IDS order, which is
// stable and documented rather than clever.
export function scoreQuiz(chosen: QuizOption[]): QuizOutcome {
  const counts: Record<SchoolId, number> = {
    stoicism: 0,
    utilitarianism: 0,
    "virtue-ethics": 0,
  };
  for (const option of chosen) {
    counts[option.school_id] += 1;
  }

  const total = Math.max(chosen.length, 1);
  const pct = (id: SchoolId) => Math.round((counts[id] / total) * 100);

  let assigned: SchoolId = SCHOOL_IDS[0];
  for (const id of SCHOOL_IDS) {
    if (counts[id] > counts[assigned]) assigned = id;
  }

  return {
    pct_stoic: pct("stoicism"),
    pct_util: pct("utilitarianism"),
    pct_virtue: pct("virtue-ethics"),
    assigned_school_id: assigned,
  };
}
