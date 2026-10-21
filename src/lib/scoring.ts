import type { QuizOption } from "../../content/quiz/questions";
import { QUIZ_SCHOOLS, type QuizSchoolId, type SchoolVector } from "./types";

export interface ScoringResult {
  primary: QuizSchoolId;
  secondary: QuizSchoolId;
  vector: SchoolVector; // normalized, sums to 1
}

const TIE_EPSILON = 0.005;

// Pure and deterministic: sums each chosen option's vector, normalizes, and
// ranks. Runs client-side; no API call anywhere in the quiz.
//
// Reads QUIZ_SCHOOLS, not the whole registry. A school being in the
// product does not make it a quiz outcome: the question bank is frozen and
// weights only the original three, so iterating every school would divide
// by keys the vectors do not have.
export function scoreQuiz(chosen: QuizOption[]): ScoringResult {
  const totals = Object.fromEntries(
    QUIZ_SCHOOLS.map((id) => [id, 0])
  ) as SchoolVector;
  for (const option of chosen) {
    for (const school of QUIZ_SCHOOLS) {
      totals[school] += option.vector[school];
    }
  }

  const sum = QUIZ_SCHOOLS.reduce((s, id) => s + totals[id], 0) || 1;
  const vector = Object.fromEntries(
    QUIZ_SCHOOLS.map((id) => [id, totals[id] / sum])
  ) as SchoolVector;

  const ranked = [...QUIZ_SCHOOLS].sort((a, b) => vector[b] - vector[a]);
  let [primary, secondary] = ranked;

  // Question 10 is written with the sharpest, least-ambiguous options
  // specifically to break ties (see content/quiz/questions.ts).
  if (Math.abs(vector[primary] - vector[secondary]) < TIE_EPSILON) {
    const tiebreaker = chosen[9];
    if (tiebreaker) {
      const winner = [...QUIZ_SCHOOLS].sort(
        (a, b) => tiebreaker.vector[b] - tiebreaker.vector[a]
      )[0];
      if (winner === secondary) [primary, secondary] = [secondary, primary];
    }
  }

  return { primary, secondary, vector };
}
