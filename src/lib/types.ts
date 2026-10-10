export type SchoolId = "stoicism" | "utilitarianism" | "virtue-ethics";

export const SCHOOL_IDS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

/**
 * Whether a string names a school the product has.
 *
 * Exists for one caller: `/styleguide/drafts`, which renders draft content
 * that may name a school the union does not hold yet. Anything keyed by
 * `SchoolId` (the colour, name, adherent and card-token maps) returns
 * `undefined` for such a string and would render "undefined" or throw, so
 * the review route narrows with this first and falls back to the raw id.
 */
export function knownSchool(id: string): id is SchoolId {
  return (SCHOOL_IDS as string[]).includes(id);
}

export interface SchoolVector {
  stoicism: number;
  utilitarianism: number;
  "virtue-ethics": number;
}

export interface QuizResultRow {
  id: string;
  school: SchoolId;
  secondary: SchoolId | null;
  vector: SchoolVector;
  challenge_from: string | null;
  created_at: string;
}
