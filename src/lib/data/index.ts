import "server-only";
import type {
  Defection,
  ForumChannel,
  Match,
  MicroLesson,
  Motion,
  Post,
  Profile,
  QuizOption,
  QuizQuestion,
  Submission,
  Thread,
  Verdict,
} from "../types";
import { createClient, isSupabaseConfigured } from "../supabase/server";
import {
  FIXTURE_DEFECTIONS,
  FIXTURE_MATCHES,
  FIXTURE_MICRO_LESSONS,
  FIXTURE_MOTIONS,
  FIXTURE_POSTS,
  FIXTURE_PROFILES,
  FIXTURE_QUIZ_OPTIONS,
  FIXTURE_QUIZ_QUESTIONS,
  FIXTURE_SUBMISSIONS,
  FIXTURE_THREADS,
  FIXTURE_VERDICTS,
} from "./fixtures";

// Single data access layer for all pages. Queries Supabase when credentials
// exist; otherwise serves the fixture mirror of seed.sql so the whole app
// renders without a database. Pages never know which one they got.

async function fromTable<T>(table: string, fallback: T[]): Promise<T[]> {
  if (!isSupabaseConfigured()) return fallback;
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*");
  if (error || !data) return fallback;
  return data as T[];
}

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  const rows = await fromTable<QuizQuestion>("quiz_questions", FIXTURE_QUIZ_QUESTIONS);
  return [...rows].sort((a, b) => a.position - b.position);
}

export async function getQuizOptions(): Promise<QuizOption[]> {
  return fromTable<QuizOption>("quiz_options", FIXTURE_QUIZ_OPTIONS);
}

export async function getMotions(): Promise<Motion[]> {
  return fromTable<Motion>("motions", FIXTURE_MOTIONS);
}

export async function getOpenMotion(): Promise<Motion | undefined> {
  const motions = await getMotions();
  const now = Date.now();
  return (
    motions.find(
      (m) => Date.parse(m.opens_at) <= now && now < Date.parse(m.closes_at)
    ) ?? motions[0]
  );
}

export async function getMicroLessonForMotion(
  motionId: string
): Promise<MicroLesson | undefined> {
  const rows = await fromTable<MicroLesson>("micro_lessons", FIXTURE_MICRO_LESSONS);
  return rows.find((ml) => ml.motion_id === motionId);
}

export async function getMatch(id: string): Promise<Match | undefined> {
  const rows = await fromTable<Match>("matches", FIXTURE_MATCHES);
  return rows.find((m) => m.id === id);
}

export async function getLatestJudgedMatch(): Promise<Match | undefined> {
  const rows = await fromTable<Match>("matches", FIXTURE_MATCHES);
  return rows.filter((m) => m.status === "judged").at(-1);
}

export async function getVerdictForMatch(
  matchId: string
): Promise<Verdict | undefined> {
  const rows = await fromTable<Verdict>("verdicts", FIXTURE_VERDICTS);
  return rows.find((v) => v.match_id === matchId);
}

export async function getSubmission(id: string): Promise<Submission | undefined> {
  const rows = await fromTable<Submission>("submissions", FIXTURE_SUBMISSIONS);
  return rows.find((s) => s.id === id);
}

export async function getSubmissionsForMotion(
  motionId: string
): Promise<Submission[]> {
  const rows = await fromTable<Submission>("submissions", FIXTURE_SUBMISSIONS);
  return rows.filter((s) => s.motion_id === motionId);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  const rows = await fromTable<Profile>("profiles", FIXTURE_PROFILES);
  return rows.find((p) => p.id === id);
}

// Auth stub. With Supabase configured this resolves the signed-in user's
// profile; in fixture mode it returns the demo profile so /me and the debate
// panel render populated.
export async function getCurrentProfile(): Promise<Profile | undefined> {
  if (!isSupabaseConfigured()) return FIXTURE_PROFILES[0];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;
  return getProfile(user.id);
}

export async function getThreads(channel?: ForumChannel): Promise<Thread[]> {
  const rows = await fromTable<Thread>("threads", FIXTURE_THREADS);
  const filtered = channel ? rows.filter((t) => t.channel === channel) : rows;
  return [...filtered].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );
}

export async function getThread(id: string): Promise<Thread | undefined> {
  const rows = await fromTable<Thread>("threads", FIXTURE_THREADS);
  return rows.find((t) => t.id === id);
}

export async function getPosts(threadId: string): Promise<Post[]> {
  const rows = await fromTable<Post>("posts", FIXTURE_POSTS);
  return rows
    .filter((p) => p.thread_id === threadId)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

export async function getDefectionsForProfile(
  profileId: string
): Promise<Defection[]> {
  const rows = await fromTable<Defection>("defections", FIXTURE_DEFECTIONS);
  return rows.filter((d) => d.profile_id === profileId);
}
