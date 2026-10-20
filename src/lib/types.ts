// The school union and the lists now live in school-registry.ts, which is
// the one place they are written down. Re-exported from here because
// twenty-six files already import `SchoolId` from this path and the type
// has not changed meaning.
//
// `SCHOOL_IDS` is deliberately gone rather than widened. It was read in
// two different senses, "the schools the quiz sorts into" and "the schools
// the product has", which are no longer the same list; removing it makes
// the compiler ask every one of its callers which it meant.
export type { SchoolId, QuizSchoolId, SchoolStatus, SchoolEntry } from "./school-registry";
export {
  SCHOOLS,
  QUIZ_SCHOOLS,
  ALL_SCHOOL_IDS,
  PUBLISHED_SCHOOL_IDS,
  knownSchool,
  schoolEntry,
  schoolName,
  isPublished,
  isQuizSchool,
} from "./school-registry";

import type { QuizSchoolId, SchoolId } from "./school-registry";

/**
 * The quiz's output: a weight per school the quiz sorts into. Keyed by
 * `QuizSchoolId`, not `SchoolId`, so adding a school to the product does
 * not silently add a field to the frozen question bank.
 */
export type SchoolVector = Record<QuizSchoolId, number>;

export interface QuizResultRow {
  id: string;
  school: SchoolId;
  secondary: SchoolId | null;
  vector: SchoolVector;
  challenge_from: string | null;
  created_at: string;
}
