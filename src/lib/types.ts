export type SchoolId = "stoicism" | "utilitarianism" | "virtue-ethics";

export const SCHOOL_IDS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

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
