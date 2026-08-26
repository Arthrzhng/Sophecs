// Row types mirroring the Supabase schema in supabase/migrations/0001_init.sql.
// Everything is keyed by school_id so adding a fourth school is a data change.

export type SchoolId = "stoicism" | "utilitarianism" | "virtue-ethics";

export interface School {
  id: SchoolId;
  name: string;
  // CSS custom property name, e.g. "--color-stoic"
  color_token: string;
}

export interface Profile {
  id: string;
  username: string;
  school_id: SchoolId | null;
  rating: number;
  streak_days: number;
  wins: number;
  losses: number;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  position: number;
}

export interface QuizOption {
  id: string;
  question_id: string;
  label: string;
  school_id: SchoolId;
}

export interface QuizResult {
  id: string;
  profile_id: string | null;
  pct_stoic: number;
  pct_util: number;
  pct_virtue: number;
  assigned_school_id: SchoolId;
  created_at: string;
}

export interface Motion {
  id: string;
  module_id: string;
  text: string;
  opens_at: string;
  closes_at: string;
}

export interface Submission {
  id: string;
  motion_id: string;
  // "system" marks the stubbed opponent used when no human is available.
  profile_id: string | "system";
  side: "for" | "against";
  body: string;
  created_at: string;
}

export type MatchStatus = "pending" | "judged";

export interface Match {
  id: string;
  motion_id: string;
  submission_a: string;
  submission_b: string;
  status: MatchStatus;
}

export interface VerdictScores {
  logic: number;
  sources: number;
  answers_opponent: number;
  clarity: number;
}

export interface Verdict {
  id: string;
  match_id: string;
  winner_submission_id: string;
  scores: { a: VerdictScores; b: VerdictScores };
  rationale: string;
}

export interface Defection {
  id: string;
  profile_id: string;
  from_school_id: SchoolId;
  to_school_id: SchoolId;
  reason: string;
  created_at: string;
}

export type ForumChannel = SchoolId | "defections";

export interface Thread {
  id: string;
  channel: ForumChannel;
  profile_id: string;
  title: string;
  created_at: string;
}

export interface Post {
  id: string;
  thread_id: string;
  profile_id: string;
  body: string;
  created_at: string;
}

// Standalone condensed teaching shown on the verdict screen, keyed by motion.
// Deliberately not linked to /lessons.
export interface MicroLesson {
  id: string;
  motion_id: string;
  body: string;
}

export const SUBMISSION_MAX_CHARS = 600;
