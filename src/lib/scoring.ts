import type { QuizOption } from "../../content/quiz/questions";
import { SCHOOL_IDS, type SchoolId, type SchoolVector } from "./types";

export interface ScoringResult {
  primary: SchoolId;
  secondary: SchoolId;
  vector: SchoolVector; // normalized, sums to 1
}

const TIE_EPSILON = 0.005;

// Pure and deterministic: sums each chosen option's vector, normalizes, and
// ranks. Runs client-side; no API call anywhere in the quiz.
export function scoreQuiz(chosen: QuizOption[]): ScoringResult {
  const totals: SchoolVector = { stoicism: 0, utilitarianism: 0, "virtue-ethics": 0 };
  for (const option of chosen) {
    for (const school of SCHOOL_IDS) {
      totals[school] += option.vector[school];
    }
  }

  const sum = SCHOOL_IDS.reduce((s, id) => s + totals[id], 0) || 1;
  const vector: SchoolVector = {
    stoicism: totals.stoicism / sum,
    utilitarianism: totals.utilitarianism / sum,
    "virtue-ethics": totals["virtue-ethics"] / sum,
  };

  const ranked = [...SCHOOL_IDS].sort((a, b) => vector[b] - vector[a]);
  let [primary, secondary] = ranked;

  // Question 10 is written with the sharpest, least-ambiguous options
  // specifically to break ties (see content/quiz/questions.ts).
  if (Math.abs(vector[primary] - vector[secondary]) < TIE_EPSILON) {
    const tiebreaker = chosen[9];
    if (tiebreaker) {
      const winner = [...SCHOOL_IDS].sort(
        (a, b) => tiebreaker.vector[b] - tiebreaker.vector[a]
      )[0];
      if (winner === secondary) [primary, secondary] = [secondary, primary];
    }
  }

  return { primary, secondary, vector };
}
