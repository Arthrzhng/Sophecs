// The dataset: every row a seed run writes, generated in memory from a seed
// and a window, before anything is written anywhere. Pure: the same config
// gives the same rows, in the same order, with the same ids.
//
// Two layers. The base window, from `from` to `baseTo`, holds the accounts,
// their quiz results, challenges, counterpart exchanges, reading answers and
// classes, and is fixed for the life of a run. Past it, to `to`, which moves
// forward each time the run is extended, either every debater's arguments
// run on from their own random stream and stop at their own lifetime, never
// at `to`; or, in a run with the weekly shape (`weekly`), the base window's
// streams stop at its end and each week from the one it ends in is drawn
// whole, with its newcomers, its returning accounts and their arguments
// and quiz results. Either way moving `to` later only appends. Rows up to
// the old `to` come out the same (tests/seed/extension.test.ts,
// tests/seed/weekly.test.ts); what a later `to` changes in them is the
// profiles' rating, streak and school, which the engine updates.
//
// What it reuses from the app rather than reimplementing:
// - the quiz bank and scoreQuiz, so a sample's school comes out of answers
//   it gave, as a reader's does (answers are biased, outcomes are not set);
//   in a run made with `quiz: 2`, quiz v2's questions (docs/quiz-v2.json,
//   the file the app reads) and scoreQuizV2, across all six schools;
// - soloElo, pairwiseElo and applyStreakDay, replayed in time order
//   (replay.ts), with a par of its own so no genuine topic par is read or
//   written;
// - checkQuote and checkBody for every exchange turn;
// - getWeeklyMotion, so most arguments are on the motion of their week;
// - the seven-day topic lock and the five-a-day limit /api/judge applies.
//
// docs/sample-activity.md describes the model and its parameters.

import { createHmac } from "node:crypto";
import { QUIZ_QUESTIONS, type QuizOption } from "../../content/quiz/questions";
import { scoreQuiz } from "../../src/lib/scoring";
import { onCircle, scoreQuizV2, type MapPoint, type MapSchoolPosition, type QuizV2Option } from "../../src/lib/quiz-v2-score";
import quizV2Raw from "../../docs/quiz-v2.json";
import { checkBody, checkQuote, authorForSeq, quoteSourceForSeq, LAPSE_DAYS, MAX_SEQ } from "../../src/lib/counterpart";
import { getWeeklyMotion } from "../../src/lib/weekly-motion";
import { Rng, ID_ALPHABET, ID_LENGTH, CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH } from "./rng";
import {
  SCHOOLS,
  TOPICS,
  compose,
  freshFragments,
  fit,
  wordCount,
  quoteFrom,
  objectionSentence,
  type Banks,
  type Parts,
  type SchoolId,
  type Tier,
  type TopicSlug,
} from "./banks";
import { templateVerdict, templateRevisionVerdict, templateRejection, scoreRuleFor, FEATURE_SCHOOLS, type Verdict, type Rejection } from "./verdicts";
import { Compositions } from "./compositions";
import { replay } from "./replay";
import { DAY, HOUR, MINUTE, TIMEZONES, activeTimeOn, dayWeight, iso, startOfUtcDay } from "./time";
import { GIVEN_NAMES, INITIALS, CLASS_NAMES } from "./names";
import readingResponseBank from "./reading-responses.json";

// Bumped whenever the same plan inputs would give different rows, so an
// older plan is refused by name rather than by a hash mismatch.
//
// Score rule 2 (verdicts.ts) did not bump it. It changes only rows dated
// from SCORE_RULE_2_FROM, which no run had written when it shipped, so the
// live run's plan still regenerates every row it wrote, and a bump would
// have refused that run by name for rows it never changed. A plan file
// made before it with a window past the cutover is still refused, by its
// manifest hash.
export const GENERATOR_VERSION = "sample-activity-3";

export interface GenConfig {
  /** Secret in production: with the public generator it fixes every row id. */
  seed: string;
  from: string; // ISO, inclusive
  /** The base window's end, fixed for the life of a run. */
  baseTo: string;
  /** Activity is generated up to here; at least baseTo. */
  to: string;
  users: number;
  anonResults: number;
  challenges: number;
  exchanges: number;
  classes: number;
  /**
   * 2: place samples by quiz v2, among all six schools, as the launch does
   * (Arthur, 2026-11-07, Gate 4 item 13: "the fresh sample run covers all
   * six schools, placed by quiz v2"). Absent, as in every run made before
   * the launch: quiz v1 and its three, every row exactly as before.
   */
  quiz?: 2;
  /**
   * A run shaped as a site on course for about 4,000 accounts over three
   * years (Arthur, 2026-11-08): from the base window's end on, each week
   * brings about `newcomers` new accounts, and each whole week after the
   * one the base window ends in exactly its own number of active
   * accounts, about `active` and never a multiple of ten, and every school
   * at least `minPerSchool` judged originals. Each week is drawn from
   * its own stream and from the weeks before it, so a later `to` only
   * appends. Quiz v2 runs only. Absent, as in every run before it: the base
   * window's own streams carry on past it, every row exactly as before.
   */
  weekly?: { newcomers: number; active: number; minPerSchool: number };
  topics: { slug: string; title: string; motion: string; sort: number; microBefore: string }[];
}

/**
 * The quiz the scheduled job's runs place samples by: 2, set by the launch
 * merge after the sample teardown, so that the fresh run and every
 * extension of it cover all six schools placed by quiz v2
 * (docs/sample-activity.md, "At launch"). Before the launch it was unset,
 * so quiz v1. A run's base hash includes the quiz when one is named, so a
 * run whose plan names none cannot be extended under quiz v2: the dry run
 * refuses a plan whose base hash is not the run's.
 */
export const RUN_QUIZ: GenConfig["quiz"] = 2;

// The run's size at its start (Arthur, 2026-11-08: "total accounts about
// 700-800 now"), the rest in proportion to the run before it (3,278
// accounts, 4,917 anonymous results, 328 challenges, 492 exchanges, 10
// classes).
export const DEFAULTS = {
  users: 738,
  anonResults: 1107,
  challenges: 74,
  exchanges: 111,
  classes: 3,
  from: "2026-09-18T00:00:00.000Z",
};

// What the scheduled job's runs grow by, week to week (Arthur, 2026-11-08:
// "roughly 200 active accounts in any week ... growing by about 25 a week.
// Every school still gets at least 20 judged originals a week").
export const RUN_WEEKLY: GenConfig["weekly"] = { newcomers: 25, active: 200, minPerSchool: 20 };

// ---- rows, in the database's own column names ----

export interface AuthUserRow {
  id: string;
  email: string;
}
export interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  school: SchoolId;
  elo: number;
  streak: number;
  streak_updated_on: string | null;
  argument_default_public: boolean;
  school_history: { from: SchoolId | null; to: SchoolId; at: string }[];
  tz: string;
  is_sample: true;
}
export interface QuizResultRow {
  id: string;
  anon_id: string;
  user_id: string | null;
  school: SchoolId;
  secondary: SchoolId;
  /** Quiz v1's three weights; null on a quiz v2 result, which has a point instead (migration 0027). */
  vector: Partial<Record<SchoolId, number>> | null;
  /** On a quiz v2 result only, as the app writes one: the version and the point. */
  quiz_version?: 2;
  map_x?: number;
  map_y?: number;
  answers: { q: number; opt: string }[];
  challenge_from: string | null;
  /** Always null: sample results carry no referrer (Arthur, 2026-11-04). */
  referrer: null;
  created_at: string;
  is_sample: true;
}
export interface ChallengeRow {
  id: string;
  challenger_result_id: string;
  challengee_result_id: string | null;
  status: "open" | "accepted" | "complete";
  topic_slug: string | null;
  created_at: string;
  is_sample: true;
}
export interface ChallengeLinkRow {
  id: string;
  challenger_debate_id: string;
  challengee_debate_id: string;
}
export interface DebateRow {
  id: string;
  user_id: string;
  topic_slug: string;
  challenge_id: string | null;
  school: SchoolId;
  argument: string;
  rejected: boolean;
  rejection_reason: string | null;
  verdict: Verdict | Rejection;
  score: number | null;
  prompt_version: string;
  argument_public: boolean;
  elo_before: number | null;
  elo_after: number | null;
  elo_recomputed_at: string | null;
  created_at: string;
  kind: "original" | "revision";
  parent_debate_id: string | null;
  seeking_counterpart_at: null;
  motion_text: string;
  is_sample: true;
  verdict_is_template: true;
}
export interface ExchangeRow {
  id: string;
  topic_slug: string;
  debate_a: string;
  debate_b: string;
  user_a: string;
  user_b: string;
  school_a: SchoolId;
  school_b: SchoolId;
  status: "open" | "complete" | "lapsed";
  publish_a: boolean;
  publish_b: boolean;
  next_turn: string | null;
  last_turn_at: string;
  created_at: string;
  is_sample: true;
}
export interface TurnRow {
  id: string;
  exchange_id: string;
  author_id: string;
  seq: number;
  quoted_claim: string;
  body: string;
  screen_result: "ok";
  screen_reason: string;
  created_at: string;
}
export interface ReadingResponseRow {
  id: string;
  user_id: string;
  topic_slug: string;
  chunk_index: number;
  response: string;
  created_at: string;
}
export interface ClassRow {
  id: string;
  code: string;
  owner_id: string;
  name: string;
  created_at: string;
}
export interface ClassMemberRow {
  class_id: string;
  user_id: string;
  joined_at: string;
}

/** One row a run owns: what the registry records, and the canary cohort it falls in. */
export interface Item<T> {
  logicalId: string;
  rowId: string;
  cohort: number;
  row: T;
}

export interface Dataset {
  runId: string;
  authUsers: Item<AuthUserRow>[];
  profiles: Item<ProfileRow>[];
  quizResults: Item<QuizResultRow>[];
  challenges: Item<ChallengeRow>[];
  challengeLinks: Item<ChallengeLinkRow>[];
  debates: Item<DebateRow>[];
  exchanges: Item<ExchangeRow>[];
  turns: Item<TurnRow>[];
  readingResponses: Item<ReadingResponseRow>[];
  classes: Item<ClassRow>[];
  classMembers: Item<ClassMemberRow>[];
  /** Per-topic par the replay ended on. Isolated: never written anywhere. */
  sampleParElo: Record<string, { par: number; n: number }>;
}

/** From the base window's end alone: the id is public and names no seed. */
export function runIdFor(baseTo: string): string {
  const stamp = baseTo.replace(/[-:T]/g, "").slice(0, 12); // yyyymmddhhmm
  return `sample-${stamp}`;
}

/**
 * `tag` comes from the seed, so an address cannot be worked out from the
 * run id, which the public workflow log prints: nobody can sign up with a
 * sample account's address first and block the run from creating it.
 */
export function emailFor(runId: string, n: number, tag: string): string {
  return `seed+${runId}-${n}-${tag}@sophecs.test`;
}

/**
 * The address tag of a run made with quiz v2, which is the fresh run at
 * the launch: HMAC-SHA256 of the run and the user's number, keyed by the
 * seed, as docs/sample-activity.md ("At launch") set out for that run. A
 * run before it takes its tag from the generator's own random streams,
 * which are not meant for secrets; changing that for the live run would
 * break its spot checks.
 */
export function emailTag(seed: string, runId: string, n: number): string {
  return createHmac("sha256", seed).update(`${runId}/${n}`).digest("hex").slice(0, 12);
}

// ---- internal working types ----

type ActivityClass = "quiz" | "light" | "regular" | "heavy";

interface User {
  n: number;
  id: string;
  rng: Rng;
  signup: number;
  tz: string;
  cls: ActivityClass;
  skill: number;
  defaultPublic: boolean;
  displayName: string;
  handle: string;
  leaning: SchoolId;
  firstResultId: string;
  schoolAt: { at: number; school: SchoolId }[];
  history: { from: SchoolId | null; to: SchoolId; at: string }[];
}

interface WorkingDebate {
  row: DebateRow;
  t: number;
  user: User;
  tier: Tier;
  parts: Parts;
  verdict: Verdict | null;
}

/** One original argument's place in a debater's stream, before its text. */
interface Slot {
  u: User;
  k: number;
  t: number;
  topic: TopicSlug;
  school: SchoolId;
  tier: Tier;
  rejected: boolean;
  argumentPublic: boolean;
  revise: { delay: number; answered: boolean } | null;
}

// Quiz v2 as the app reads it (src/lib/quiz-v2.ts, from the same file):
// the questions with each option's vector, and the schools in the file's
// order, which breaks the last tie. The app's loader is server-only and
// shows the quiz on SIX_SCHOOLS builds only; the seed reads the file.
const QUIZ_V2: { questions: { id: number; options: QuizV2Option[] }[]; schools: MapSchoolPosition[] } = {
  questions: quizV2Raw.questions.map((q) => ({
    id: q.id,
    options: q.options.map((o) => ({ id: o.id, label: o.label, vector: { x: o.vector.x, y: o.vector.y } })),
  })),
  schools: Object.entries(quizV2Raw.schools).map(([id, s]) => ({ id, angle: s.angle })),
};
const QUIZ_V2_DIRECTION = new Map<string, MapPoint>(QUIZ_V2.schools.map((s) => [s.id, onCircle(s.angle)]));

export function generate(cfg: GenConfig, banks: Banks): Dataset {
  const from = Date.parse(cfg.from);
  // Everything but the arguments ends at the base window's end, which is
  // called `to` below; the arguments run on to `horizon`.
  const to = Date.parse(cfg.baseTo);
  const horizon = Date.parse(cfg.to);
  if (!(to > from)) throw new Error("the window ends before it starts");
  if (horizon < to) throw new Error("the run cannot be extended to before its base window ends");
  const runId = runIdFor(cfg.baseTo);
  // The base window is part of the root: the same seed with another base
  // gives other ids, so a new run never collides with a torn-down run's
  // ids, which the registry keeps for its audit. `to` is not, so extending
  // a run keeps its ids.
  const root = new Rng(`sophecs-sample/${GENERATOR_VERSION}/${cfg.seed}/${cfg.from}/${cfg.baseTo}`);
  const days = Math.ceil((to - from) / DAY);
  const id = (r: Rng) => r.token(ID_ALPHABET, ID_LENGTH);
  const topicBySlug = new Map(cfg.topics.map((t) => [t.slug, t]));
  for (const slug of TOPICS) if (!topicBySlug.has(slug)) throw new Error(`topic ${slug} is not active`);

  // ---- 1. when people arrive: growth, a launch bump, weekdays ----
  const dayStarts = Array.from({ length: days }, (_, d) => startOfUtcDay(from) + d * DAY);
  const arrivalWeights = dayStarts.map((t, d) => {
    const growth = 0.35 + 0.65 * (d / Math.max(1, days - 1));
    const launch = 1 + 2.2 * Math.exp(-(((d - 4) / 3) ** 2));
    return [t, growth * launch * dayWeight(t)] as const;
  });
  const arrival = (r: Rng, tz: string, earliest = from): number => {
    for (let i = 0; i < 40; i++) {
      const day = r.weighted(arrivalWeights);
      const t = activeTimeOn(r, tz, day, Math.max(from, earliest), to - 10 * MINUTE);
      if (t !== null) return t;
    }
    return Math.max(from, earliest) + r.int(1, 60) * MINUTE;
  };

  // ---- 2. the quiz: answers biased by a leaning, outcomes by the quiz's own scorer ----
  // A run with `quiz: 2` places samples by quiz v2 among all six schools;
  // any other run by quiz v1 among its three, drawing exactly as before.
  const v2 = cfg.quiz === 2;
  // The fresh run's positions open on their claim (`freshFragments`): no
  // sentence in front that states only the stance, and four of the live
  // three's reworded; a run that names no quiz reads the passages exactly
  // as written.
  if (v2) banks = { ...banks, fragments: Object.fromEntries(TOPICS.map((t) => [t, freshFragments(banks.fragments[t])])) as Banks["fragments"] };
  // Quiz v2's schools in the quiz file's order, not the registry's lists,
  // which the launch changes when it publishes the three: a quiz v2 run
  // regenerates its rows from this code, so they must not move under it.
  const schools: readonly SchoolId[] = v2 ? QUIZ_V2.schools.map((s) => s.id as SchoolId) : SCHOOLS;
  if (v2) {
    // And the quiz, the passages, the closings and the verdicts' lines all
    // cover the same six, or the run is refused before anything is made.
    const same = (xs: Iterable<string>) => [...xs].sort().join() === [...schools].sort().join();
    const lacking = [
      ...TOPICS.filter((t) => !same(Object.keys(banks.fragments[t].schools))).map((t) => `the passages of ${t}`),
      ...TOPICS.filter((t) => !same(Object.keys(banks.motionClosings[t] ?? {}))).map((t) => `the closings of ${t}`),
      ...(same(FEATURE_SCHOOLS) ? [] : ["the template verdicts' lines"]),
    ];
    if (lacking.length) throw new Error(`a quiz v2 run needs the same schools in the quiz and in ${lacking.join(", ")}`);
  }
  const quizRng = root.fork("quiz-calibration");
  // Quiz v1's mix as it was; under quiz v2 an equal share each, so the six
  // are equally active (the ruling: "launch week shows six active schools").
  const target: Partial<Record<SchoolId, number>> = v2
    ? Object.fromEntries(schools.map((s) => [s, 1 / schools.length]))
    : { stoicism: 0.4, utilitarianism: 0.35, "virtue-ethics": 0.25 };
  const answer = (r: Rng, leaning: SchoolId, strength: number): QuizOption[] =>
    QUIZ_QUESTIONS.map((q) => r.weighted(q.options.map((o) => [o, Math.exp(3 * strength * o.vector[leaning as keyof typeof o.vector])] as const)));
  // The same bias under quiz v2: an option weighs by how far its vector
  // points towards the leaning's place on the map.
  const answerV2 = (r: Rng, leaning: SchoolId, strength: number): QuizV2Option[] => {
    const d = QUIZ_V2_DIRECTION.get(leaning)!;
    return QUIZ_V2.questions.map((q) => r.weighted(q.options.map((o) => [o, Math.exp(3 * strength * (o.vector.x * d.x + o.vector.y * d.y))] as const)));
  };
  const primaryOf = (r: Rng, lean: SchoolId, strength: number): SchoolId =>
    (v2 ? scoreQuizV2(answerV2(r, lean, strength), QUIZ_V2.schools).primary : scoreQuiz(answer(r, lean, strength)).primary) as SchoolId;
  // Leanings are weighted so that outcomes land near the target mix; the
  // weights are found on a calibration sample, deterministically.
  let leanWeights = { ...target } as Record<SchoolId, number>;
  for (let iter = 0; iter < 4; iter++) {
    const counts = Object.fromEntries(schools.map((s) => [s, 0])) as Record<SchoolId, number>;
    const r = quizRng.fork(`iter-${iter}`);
    for (let i = 0; i < 3000; i++) {
      const lean = r.weighted(schools.map((s) => [s, leanWeights[s]] as const));
      counts[primaryOf(r, lean, r.float(0.4, 1.4))]++;
    }
    leanWeights = Object.fromEntries(
      schools.map((s) => [s, leanWeights[s] * (target[s]! / Math.max(0.01, counts[s] / 3000))])
    ) as Record<SchoolId, number>;
  }
  const takeQuiz = (r: Rng, lean: SchoolId): Pick<QuizResultRow, "school" | "secondary" | "vector" | "quiz_version" | "map_x" | "map_y" | "answers"> => {
    if (v2) {
      const chosen = answerV2(r, lean, r.float(0.4, 1.4));
      const result = scoreQuizV2(chosen, QUIZ_V2.schools);
      // In the order and shape submitQuizResultV2 writes them.
      return {
        school: result.primary as SchoolId,
        secondary: result.secondary as SchoolId,
        vector: null,
        quiz_version: 2,
        map_x: result.point.x,
        map_y: result.point.y,
        answers: chosen.map((o, i) => ({ q: QUIZ_V2.questions[i].id, opt: o.id })),
      };
    }
    const chosen = answer(r, lean, r.float(0.4, 1.4));
    const result = scoreQuiz(chosen);
    return {
      school: result.primary as SchoolId,
      secondary: result.secondary as SchoolId,
      vector: result.vector as Record<SchoolId, number>,
      answers: chosen.map((o, i) => ({ q: i + 1, opt: o.id })),
    };
  };

  // ---- 3. users ----
  const userRng = root.fork("users");
  const rawUsers = Array.from({ length: cfg.users }, (_, i) => {
    const r = userRng.fork(`u${i}`);
    const tz = r.weighted(TIMEZONES);
    return { r, tz, signup: arrival(r, tz) };
  }).sort((a, b) => a.signup - b.signup);

  // Activity classes, by exact count: 60% quiz only, 25% one to three
  // arguments, 12% four to twenty-nine, 3% thirty or more. Heavy users need
  // the time to write thirty arguments under a seven-day lock per motion,
  // so they come from the early arrivals.
  const classRng = root.fork("classes-of-activity");
  const remainingDays = rawUsers.map((u) => (to - u.signup) / DAY);
  const cls: ActivityClass[] = rawUsers.map(() => "quiz");
  const take = (count: number, weight: (i: number) => number, as: ActivityClass) => {
    const pool = cls.map((c, i) => i).filter((i) => cls[i] === "quiz" && weight(i) > 0);
    for (let k = 0; k < count && pool.length; k++) {
      const pick = classRng.weighted(pool.map((i) => [i, weight(i)] as const));
      cls[pick] = as;
      pool.splice(pool.indexOf(pick), 1);
    }
  };
  take(Math.round(cfg.users * 0.03), (i) => (remainingDays[i] >= 36 ? 1 : 0), "heavy");
  take(Math.round(cfg.users * 0.12), (i) => Math.min(30, Math.max(0, remainingDays[i] - 3)), "regular");
  take(Math.round(cfg.users * 0.25), () => 1, "light");

  const usedHandles = new Set<string>();
  // One account, drawing in the order the base window's always have.
  const makeUser = (n: number, r: Rng, signup: number, tz: string, c: ActivityClass): User => {
    const given = r.pick(GIVEN_NAMES);
    const initial = r.pick(INITIALS.split(""));
    let handle = `${given.toLowerCase()}_${initial.toLowerCase()}${r.int(10, 9999)}`;
    while (usedHandles.has(handle)) handle = `${handle}${r.int(0, 9)}`;
    usedHandles.add(handle);
    const leaning = r.weighted(schools.map((s) => [s, leanWeights[s]] as const));
    return {
      n,
      id: r.uuid(),
      rng: r,
      signup,
      tz,
      cls: c,
      skill: Math.min(1, Math.max(0, r.normal(0.5, 0.2))),
      defaultPublic: r.chance(0.35),
      displayName: `${given} ${initial}.`,
      handle,
      leaning,
      firstResultId: "",
      schoolAt: [],
      history: [],
    };
  };
  const users: User[] = rawUsers.map((u, n) => makeUser(n, u.r, u.signup, u.tz, cls[n]));
  if (cfg.weekly && !v2) throw new Error("a weekly run is a quiz v2 run");

  const authUserItem = (u: User): Item<AuthUserRow> => ({
    logicalId: `user:${u.n}`,
    rowId: u.id,
    cohort: u.n,
    row: { id: u.id, email: emailFor(runId, u.n, v2 ? emailTag(cfg.seed, runId, u.n) : root.fork(`email/${u.n}`).token("abcdefghijklmnopqrstuvwxyz0123456789", 12)) },
  });
  const authUsers: Item<AuthUserRow>[] = users.map(authUserItem);

  // Cohort for rows that belong to no user: the number of users who had
  // arrived by then, so a canary of the first K users takes the anonymous
  // activity of the same period.
  const signups = users.map((u) => u.signup);
  const cohortAt = (t: number) => {
    let lo = 0,
      hi = signups.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (signups[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // ---- 4. quiz results: each account's first, retakes, anonymous ----
  const quizResults: Item<QuizResultRow>[] = [];
  const resultById = new Map<string, Item<QuizResultRow>>();
  const pushResult = (item: Item<QuizResultRow>) => {
    quizResults.push(item);
    resultById.set(item.rowId, item);
  };
  for (const u of users) {
    const r = u.rng.fork("quiz");
    const quiz = takeQuiz(r, u.leaning);
    const t = u.signup - r.int(2, 40) * MINUTE;
    const rid = id(r);
    u.firstResultId = rid;
    u.schoolAt.push({ at: u.signup, school: quiz.school });
    pushResult({
      logicalId: `result:user:${u.n}:0`,
      rowId: rid,
      cohort: u.n,
      row: {
        id: rid,
        anon_id: r.uuid(),
        user_id: u.id,
        ...quiz,
        challenge_from: null,
        referrer: null,
        created_at: iso(t),
        is_sample: true,
      },
    });
    // About 8% switch school once and a few twice, by retaking the quiz
    // while signed in (retakeQuizSchool appends to school_history).
    const switches = r.chance(0.095) ? (r.chance(0.12) ? 2 : 1) : 0;
    let at = u.signup;
    for (let k = 1; k <= switches; k++) {
      const room = to - at - HOUR;
      if (room < 2 * DAY) break;
      at = at + DAY + r.float(0, Math.min(room - DAY, 21 * DAY));
      const current = u.schoolAt[u.schoolAt.length - 1].school;
      let retake = null;
      for (let tries = 0; tries < 30 && !retake; tries++) {
        const lean = r.pick(schools.filter((s) => s !== current));
        const q = takeQuiz(r, lean);
        if (q.school !== current) retake = q;
      }
      if (!retake) break;
      const rrid = id(r);
      pushResult({
        logicalId: `result:user:${u.n}:${k}`,
        rowId: rrid,
        cohort: u.n,
        row: {
          id: rrid,
          anon_id: r.uuid(),
          user_id: u.id,
          ...retake,
          challenge_from: null,
          referrer: null,
          created_at: iso(at),
          is_sample: true,
        },
      });
      u.schoolAt.push({ at, school: retake.school });
      u.history.push({ from: current, to: retake.school, at: iso(at) });
    }
  }
  const anonRng = root.fork("anonymous");
  const anonResults: Item<QuizResultRow>[] = [];
  for (let i = 0; i < cfg.anonResults; i++) {
    const r = anonRng.fork(`a${i}`);
    const tz = r.weighted(TIMEZONES);
    const t = arrival(r, tz);
    const lean = r.weighted(schools.map((s) => [s, leanWeights[s]] as const));
    const quiz = takeQuiz(r, lean);
    const rid = id(r);
    const item: Item<QuizResultRow> = {
      logicalId: `result:anon:${i}`,
      rowId: rid,
      cohort: cohortAt(t),
      row: {
        id: rid,
        anon_id: r.uuid(),
        user_id: null,
        ...quiz,
        challenge_from: null,
        referrer: null,
        created_at: iso(t),
        is_sample: true,
      },
    };
    anonResults.push(item);
    pushResult(item);
  }
  const schoolOf = (u: User, t: number): SchoolId => {
    let s = u.schoolAt[0].school;
    for (const e of u.schoolAt) if (e.at <= t) s = e.school;
    return s;
  };

  // ---- 5. arguments ----
  // Three passes. (a) Each debater's originals, from their own stream:
  // when, on which motion, from which school, of what quality, rejected or
  // not, and whether they will revise. The stream stops at the debater's
  // own lifetime or budget, and at `horizon` before anything about the next
  // argument is drawn, so a later horizon only appends. (b) Texts, given out
  // in time order across everyone, each composition of the passages once
  // before any repeats (compositions.ts). (c) Revisions, each from its
  // parent's own stream.
  const debateRng = root.fork("debates");
  const weeklyTopics = cfg.topics.map((t) => ({ slug: t.slug, title: t.title, sort: t.sort }));
  const pickTier = (r: Rng, skill: number): Tier => {
    const shift = 0.3 * (skill - 0.5);
    return r.weighted([
      ["strong", 0.25 + shift],
      ["mid", 0.5],
      ["weak", 0.25 - shift],
    ] as const);
  };

  const slots: Slot[] = [];
  // A weekly run's own streams stop at the base window's end; the weeks
  // from the one it ends in are drawn whole, below (5w). `firstFull` is the
  // first of them the base window has no part of.
  const mondayOf = (t: number) => startOfUtcDay(t) - ((new Date(startOfUtcDay(t)).getUTCDay() + 6) % 7) * DAY;
  const firstFull = mondayOf(to) === to ? to : mondayOf(to) + 7 * DAY;
  const streamEnd = cfg.weekly ? to : horizon;
  for (const u of users) {
    if (u.cls === "quiz") continue;
    const r = debateRng.fork(`u${u.n}`);
    // About 15% of debaters revise: half the heavy users, and one in
    // eight of the rest. A reviser revises some of their arguments.
    const reviser = r.chance(u.cls === "heavy" ? 0.5 : 0.125);
    const budget =
      u.cls === "light"
        ? r.weighted([[1, 0.5], [2, 0.3], [3, 0.2]] as const)
        : u.cls === "regular"
          ? Math.min(29, 4 + Math.round(r.exponential(7)))
          : Infinity;
    const reviseChance = !reviser ? 0 : u.cls === "light" ? 0.6 : u.cls === "regular" ? 0.3 : 0.15;
    // Most people drop off within a fortnight; regulars last longer; heavy
    // users stay for months.
    const lifetime =
      u.cls === "light"
        ? Math.min(20 * DAY, Math.max(0.05 * DAY, r.exponential(4 * DAY)))
        : u.cls === "regular"
          ? 6 * DAY + r.exponential(14 * DAY)
          : 120 * DAY + r.exponential(365 * DAY);
    const end = u.signup + lifetime;
    const lockedUntil = new Map<string, number>();
    const recent: number[] = [];
    let t = u.signup + r.int(3, 45) * MINUTE;
    let k = 0;
    let guard = 0;
    while (k < budget && t < end && t <= streamEnd && guard++ < 1_000_000) {
      // Five a day, as /api/judge counts them: within any 24 hours.
      while (recent.length && recent[0] <= t - DAY) recent.shift();
      if (recent.length >= 5) {
        t = recent[0] + DAY + r.int(5, 120) * MINUTE;
        continue;
      }
      const weekly = getWeeklyMotion(weeklyTopics, new Date(t))!.slug as TopicSlug;
      const open = TOPICS.filter((x) => (lockedUntil.get(x) ?? 0) <= t);
      if (open.length === 0) {
        t = Math.min(...[...lockedUntil.values()]) + r.int(30, 600) * MINUTE;
        continue;
      }
      const topic = open.includes(weekly) && r.chance(0.6) ? weekly : r.pick(open);
      const school = schoolOf(u, t);
      const progress = Math.min(1, (t - u.signup) / (30 * DAY));
      const tier = pickTier(r, Math.min(1, u.skill + (u.cls === "heavy" ? 0.15 * progress : 0)));
      const rejected = r.chance(tier === "weak" ? 0.06 : tier === "mid" ? 0.024 : 0.01);
      const argumentPublic = r.chance(0.1) ? !u.defaultPublic : u.defaultPublic;
      let revise =
        !rejected && r.chance(reviseChance)
          ? { delay: Math.max(10 * MINUTE, Math.min(6 * DAY, r.exponential(DAY))), answered: r.chance(0.85) }
          : null;
      // In a weekly run a base revision lands before the first whole week,
      // as a weekly one stays in its own: a whole week's active accounts
      // are then exactly the ones drawn for it (review of #115, B1). One
      // that would land later is not made (drawn all the same, so nothing
      // after it moves).
      if (cfg.weekly && revise && t + revise.delay > firstFull - 10 * MINUTE) revise = null;
      slots.push({ u, k, t, topic, school, tier, rejected, argumentPublic, revise });
      k++;
      lockedUntil.set(topic, t + 7 * DAY + MINUTE);
      recent.push(t);
      // The next argument: often the same sitting, otherwise a later day,
      // with long gaps more likely as interest fades.
      if (r.chance(u.cls === "light" ? 0.35 : 0.45)) t += r.int(4, 30) * MINUTE;
      else {
        const gapDays = u.cls === "heavy" ? r.exponential(0.6) : u.cls === "regular" ? r.exponential(1.8) : r.exponential(2.5);
        let next: number | null = null;
        const firstDay = startOfUtcDay(t + Math.max(u.cls === "heavy" ? 0 : 1, Math.round(gapDays)) * DAY);
        for (let d = 0; d < 4 && next === null; d++) next = activeTimeOn(r, u.tz, firstDay + d * DAY, t + 10 * MINUTE, end);
        t = next ?? end + 1;
      }
    }
  }

  // ---- 5w. the weeks after the base window (`weekly`) ----
  // Each week from the one the base window ends in: about `newcomers` new
  // accounts, each taking the quiz as they join; then returning accounts,
  // drawn by how engaged each is and how long ago they joined, until the
  // week holds exactly its number of active accounts; then, for any school
  // short of `minPerSchool` judged originals, more from its active members.
  // A week is drawn whole from its own stream and the weeks before it, and
  // only what falls by `to` is kept, so a later `to` only appends.
  const weeklyUsers: User[] = [];
  const lateResults: Item<QuizResultRow>[] = [];
  // Their results join the run's after the base window's challenges,
  // exchanges and classes are drawn, which belong to the base window alone.
  const weeklyResults: Item<QuizResultRow>[] = [];
  if (cfg.weekly) {
    const W = cfg.weekly;
    const WEEK = 7 * DAY;
    const wkRng = root.fork("weekly");
    const CLASS_WEIGHT: Record<ActivityClass, number> = { quiz: 0.3, light: 1, regular: 3, heavy: 7 };
    const HALF_LIFE_WEEKS: Record<ActivityClass, number> = { quiz: 3, light: 5, regular: 16, heavy: 70 };
    const NEW_CLASS = [["quiz", 0.6], ["light", 0.25], ["regular", 0.12], ["heavy", 0.03]] as const;
    interface Carry { k: number; results: number; locked: Map<TopicSlug, number>; recent: number[]; reviseChance: number }
    const carry = new Map<User, Carry>();
    const carryOf = (u: User): Carry => {
      let c = carry.get(u);
      if (!c) {
        const tr = u.rng.fork("weekly");
        const reviser = tr.chance(u.cls === "heavy" ? 0.5 : 0.125);
        c = {
          k: 0,
          results: 1 + u.history.length,
          locked: new Map(),
          recent: [],
          reviseChance: !reviser ? 0 : u.cls === "light" ? 0.6 : u.cls === "regular" ? 0.3 : 0.15,
        };
        carry.set(u, c);
      }
      return c;
    };
    // What the base window leaves each account with.
    for (const slot of [...slots].sort((a, b) => a.t - b.t)) {
      const c = carryOf(slot.u);
      c.k = Math.max(c.k, slot.k + 1);
      c.locked.set(slot.topic, slot.t + 7 * DAY + MINUTE);
      c.recent.push(slot.t);
    }
    const retake = (u: User, at: number, r: Rng) => {
      const current = schoolOf(u, at);
      let q = null;
      for (let tries = 0; tries < 30 && !q; tries++) {
        const t = takeQuiz(r, r.pick(schools.filter((x) => x !== current)));
        if (t.school !== current) q = t;
      }
      if (!q) return false;
      const c = carryOf(u);
      const rid = id(r);
      lateResults.push({
        logicalId: `result:user:${u.n}:${c.results++}`,
        rowId: rid,
        cohort: u.n,
        row: { id: rid, anon_id: r.uuid(), user_id: u.id, ...q, challenge_from: null, referrer: null, created_at: iso(at), is_sample: true },
      });
      u.schoolAt.push({ at, school: q.school });
      u.history.push({ from: current, to: q.school, at: iso(at) });
      return true;
    };
    // One original at or after `t`, inside the week, by the rules the base
    // window's streams keep: five within any 24 hours, seven days between
    // two on one motion. Returns its time, or null if none fits.
    // An original before `keepFrom` is drawn and not kept: the base window
    // holds that part of the week (see the loop below).
    const original = (u: User, t: number, latest: number, r: Rng, out: Slot[], forceKept = false, keepFrom = -Infinity): number | null => {
      const c = carryOf(u);
      for (let guard = 0; guard < 40; guard++) {
        if (t > latest) return null;
        while (c.recent.length && c.recent[0] <= t - DAY) c.recent.shift();
        if (c.recent.length >= 5) {
          t = c.recent[0] + DAY + r.int(5, 120) * MINUTE;
          continue;
        }
        const open = TOPICS.filter((x) => (c.locked.get(x) ?? 0) <= t);
        if (open.length === 0) {
          t = Math.min(...[...c.locked.values()]) + r.int(30, 600) * MINUTE;
          continue;
        }
        const weekly = getWeeklyMotion(weeklyTopics, new Date(t))!.slug as TopicSlug;
        const topic = open.includes(weekly) && r.chance(0.6) ? weekly : r.pick(open);
        const school = schoolOf(u, t);
        const tier = pickTier(r, Math.min(1, u.skill + (u.cls === "heavy" ? 0.15 : 0)));
        const rejected = !forceKept && r.chance(tier === "weak" ? 0.06 : tier === "mid" ? 0.024 : 0.01);
        const argumentPublic = r.chance(0.1) ? !u.defaultPublic : u.defaultPublic;
        // A revision lands in the same week, so a week's active accounts are
        // exactly the ones drawn for it. One that would land after the week
        // is not made, rather than moved to its last minute, where every
        // such revision would land at once.
        let revise: Slot["revise"] = null;
        if (!rejected && r.chance(c.reviseChance)) {
          const delay = Math.max(10 * MINUTE, Math.min(6 * DAY, r.exponential(DAY)));
          const answered = r.chance(0.85);
          if (t + delay <= latest) revise = { delay, answered };
        }
        if (t < keepFrom) return t;
        out.push({ u, k: c.k++, t, topic, school, tier, rejected, argumentPublic, revise });
        c.locked.set(topic, t + 7 * DAY + MINUTE);
        c.recent.push(t);
        return t;
      }
      return null;
    };
    const dayOf = (r: Rng, from: number, until: number) => {
      const days: (readonly [number, number])[] = [];
      for (let d = startOfUtcDay(from); d < until; d += DAY) days.push([d, dayWeight(d)] as const);
      return days.length ? r.weighted(days) : null;
    };
    const timeIn = (r: Rng, tz: string, from: number, until: number): number | null => {
      for (let tries = 0; tries < 8; tries++) {
        const day = dayOf(r, from, until);
        if (day === null) return null;
        const t = activeTimeOn(r, tz, day, from, until);
        if (t !== null) return t;
      }
      return null;
    };
    // The week the base window ends in is drawn whole too, from its Monday,
    // and only what falls after the base window's end is kept: the base
    // window's own streams hold the part before it. So that week runs at
    // one rate throughout, with no burst after the base window's end and
    // no lull before the next Monday (review of #115, B1). Its count of
    // active accounts is the base window's and the kept draw's together,
    // so it is not drawn exactly, as every whole week after it is.
    const weekSlots: Slot[] = [];
    for (let ws = mondayOf(to); ws <= horizon; ws += WEEK) {
      const we = ws + WEEK;
      const start = ws;
      const keepFrom = Math.max(ws, to);
      const latest = we - 10 * MINUTE;
      const r = wkRng.fork(iso(ws).slice(0, 10));
      const thisWeek: Slot[] = [];

      // Newcomers, each with their quiz as they join.
      const arrivals: { r: Rng; tz: string; t: number }[] = [];
      const want = Math.max(0, Math.round(r.normal(W.newcomers, W.newcomers * 0.2)));
      for (let i = 0; i < want; i++) {
        const ar = r.fork(`newcomer/${i}`);
        const tz = ar.weighted(TIMEZONES);
        // Far enough in that the quiz they take first falls in this week too.
        const t = timeIn(ar, tz, start + 45 * MINUTE, latest);
        if (t !== null) arrivals.push({ r: ar, tz, t });
      }
      arrivals.sort((a, b) => a.t - b.t);
      const actives = new Set<User>();
      // How many accounts a whole week's draw has made active, kept or not.
      let drawn = arrivals.length;
      for (const a of arrivals) {
        if (a.t < keepFrom + 45 * MINUTE) continue;
        const u = makeUser(users.length + weeklyUsers.length, a.r.fork("user"), a.t, a.tz, a.r.weighted(NEW_CLASS));
        weeklyUsers.push(u);
        const qr = u.rng.fork("quiz");
        const quiz = takeQuiz(qr, u.leaning);
        const rid = id(qr);
        u.firstResultId = rid;
        u.schoolAt.push({ at: u.signup, school: quiz.school });
        lateResults.push({
          logicalId: `result:user:${u.n}:0`,
          rowId: rid,
          cohort: u.n,
          row: { id: rid, anon_id: qr.uuid(), user_id: u.id, ...quiz, challenge_from: null, referrer: null, created_at: iso(Math.max(keepFrom, u.signup - qr.int(2, 40) * MINUTE)), is_sample: true },
        });
        actives.add(u);
        const nr = r.fork(`newcomer-activity/${u.n}`);
        const n =
          u.cls === "quiz" ? 0 : u.cls === "light" ? nr.weighted([[0, 0.15], [1, 0.55], [2, 0.3]] as const) : u.cls === "regular" ? nr.int(1, 3) : nr.int(2, 4);
        let t: number | null = u.signup + nr.int(3, 45) * MINUTE;
        for (let k = 0; k < n && t !== null; k++) {
          t = original(u, t, latest, nr, thisWeek);
          if (t !== null) t += nr.int(4, 40) * MINUTE;
        }
      }

      // Returning accounts, until the week holds its number. Never a
      // multiple of ten (Arthur: "e.g. 183, 207, 196, never a round number").
      let target = Math.round(r.normal(W.active, W.active * 0.045));
      if (target % 10 === 0) target += r.chance(0.5) ? 1 : -1;
      const pool = [...users, ...weeklyUsers].filter((u) => u.signup < start && !actives.has(u));
      const keyed = pool
        .map((u) => {
          const age = Math.max(0, (ws - u.signup) / WEEK);
          const w = CLASS_WEIGHT[u.cls] * (0.25 + 0.75 * 2 ** (-age / HALF_LIFE_WEEKS[u.cls]));
          return { u, key: Math.log(Math.max(1e-12, r.float(0, 1))) / w };
        })
        .sort((a, b) => b.key - a.key || a.u.n - b.u.n);
      for (const { u } of keyed) {
        if (drawn >= target) break;
        const ar = r.fork(`active/${u.n}`);
        const n = u.cls === "heavy" ? ar.int(2, 6) : u.cls === "regular" ? ar.int(1, 3) : u.cls === "light" ? ar.weighted([[1, 0.7], [2, 0.3]] as const) : ar.chance(0.5) ? 1 : 0;
        let t = timeIn(ar, u.tz, start, latest);
        if (t === null) continue;
        let did = false;
        let kept = false;
        // A returning account that writes nothing retakes the quiz; a few
        // others do too, as a reader might.
        if (n === 0 || ar.chance(0.03)) {
          if (t < keepFrom) did = true;
          else if (retake(u, t, ar)) did = kept = true;
        }
        for (let k = 0; k < n; k++) {
          const made = original(u, t + (did ? ar.int(5, 30) * MINUTE : 0), latest, ar, thisWeek, false, keepFrom);
          if (made === null) break;
          did = true;
          if (made >= keepFrom) kept = true;
          t = ar.chance(0.45) ? made + ar.int(4, 30) * MINUTE : (timeIn(ar, u.tz, made + 2 * HOUR, latest) ?? made + ar.int(4, 30) * MINUTE);
        }
        if (did) drawn++;
        if (kept) actives.add(u);
      }

      // Every school at least `minPerSchool` judged originals, with two to
      // spare: more from its members already active this week.
      const counted = new Map<SchoolId, number>();
      for (const sl of [...slots, ...thisWeek]) if (sl.t >= ws && sl.t < we && !sl.rejected) counted.set(sl.school, (counted.get(sl.school) ?? 0) + 1);
      for (const school of schools) {
        const tr = r.fork(`top-up/${school}`);
        const members = [...actives].filter((u) => schoolOf(u, keepFrom) === schoolOf(u, latest) && schoolOf(u, latest) === school).sort((a, b) => a.n - b.n);
        for (let guard = 0; (counted.get(school) ?? 0) < W.minPerSchool + 2 && members.length && guard < 400; guard++) {
          const u = tr.pick(members);
          // After the account's latest original, since original() keeps its
          // five-in-24-hours count by times that only increase.
          const after = Math.max(keepFrom, u.signup + 5 * MINUTE, (carryOf(u).recent.at(-1) ?? 0) + 10 * MINUTE);
          const t = timeIn(tr, u.tz, after, latest);
          if (t !== null && original(u, t, latest, tr, thisWeek, true) !== null) counted.set(school, (counted.get(school) ?? 0) + 1);
        }
      }
      weekSlots.push(...thisWeek);
    }
    // Only what has happened by `to`.
    for (const sl of weekSlots) if (sl.t <= horizon) slots.push(sl);
    for (const u of weeklyUsers) if (u.signup <= horizon) authUsers.push(authUserItem(u));
    const signupOf = new Map([...users, ...weeklyUsers].map((u) => [u.id, u.signup]));
    for (const item of lateResults) if (Date.parse(item.row.created_at) <= horizon && signupOf.get(item.row.user_id!)! <= horizon) weeklyResults.push(item);
  }
  slots.sort((a, b) => a.t - b.t || a.u.n - b.u.n || a.k - b.k);

  // A quiz v2 run closes with each motion's own closings (Arthur,
  // 2026-11-08); a run that names no quiz with closings.json, as before.
  const closingsOf = (topic: TopicSlug) => (v2 ? banks.motionClosings[topic] : banks.closings);
  const compositions = new Compositions(banks, root.fork("compositions"), v2 ? closingsOf : undefined);
  const debates: WorkingDebate[] = [];
  const revisionsOf: { parent: WorkingDebate; slot: Slot }[] = [];
  for (const slot of slots) {
    const { u, topic, school, tier } = slot;
    const r = root.fork(`debate/${u.n}/${slot.k}`);
    const fr = banks.fragments[topic];
    const parts = compositions.next(topic, school, tier);
    const verdict = slot.rejected ? null : templateVerdict(fr, { school, tier }, parts, u.skill, r, scoreRuleFor(slot.t, to));
    const rejection = slot.rejected ? templateRejection(r, scoreRuleFor(slot.t, to)) : null;
    const rid = id(r);
    const row: DebateRow = {
      id: rid,
      user_id: u.id,
      topic_slug: topic,
      challenge_id: null,
      school,
      argument: withTypos(compose(fr, closingsOf(topic), school, parts), verdict, r),
      rejected: slot.rejected,
      rejection_reason: rejection ? rejection.rejection_reason : null,
      verdict: verdict ?? rejection!,
      score: verdict ? verdict.score : null,
      prompt_version: (verdict ?? rejection!).prompt_version,
      argument_public: slot.argumentPublic,
      elo_before: null,
      elo_after: null,
      elo_recomputed_at: null,
      created_at: iso(slot.t),
      kind: "original",
      parent_debate_id: null,
      seeking_counterpart_at: null,
      motion_text: topicBySlug.get(topic)!.motion,
      is_sample: true,
      verdict_is_template: true,
    };
    const d: WorkingDebate = { row, t: slot.t, user: u, tier, parts, verdict };
    debates.push(d);
    if (slot.revise) revisionsOf.push({ parent: d, slot });
  }

  // Revisions answer the objection the verdict named, some time later.
  for (const { parent, slot } of revisionsOf) {
    if (!parent.verdict || !parent.verdict.unanswered_objection) continue;
    const rt = parent.t + slot.revise!.delay;
    if (rt > horizon) continue;
    const r = root.fork(`revision/${slot.u.n}/${slot.k}`);
    const fr = banks.fragments[parent.row.topic_slug as TopicSlug];
    const s = fr.schools[parent.row.school];
    const answeredIdx = s.objections.findIndex((o) => o.rival === parent.verdict!.unanswered_objection!.school);
    const revisedParts = fit(fr, closingsOf(parent.row.topic_slug as TopicSlug), parent.row.school, {
      ...parent.parts,
      objections: [...parent.parts.objections, answeredIdx],
    });
    const verdict = templateRevisionVerdict(fr, parent.row.school, parent.tier, parent.verdict, revisedParts, answeredIdx, slot.revise!.answered, r, scoreRuleFor(rt, to), { freshRun: v2 });
    const rid = id(r);
    debates.push({
      row: {
        ...parent.row,
        id: rid,
        challenge_id: null,
        argument: compose(fr, closingsOf(parent.row.topic_slug as TopicSlug), parent.row.school, revisedParts),
        rejected: false,
        rejection_reason: null,
        verdict,
        score: verdict.score,
        // Its own rule's, not the parent's: under rule 2 the two can differ.
        prompt_version: verdict.prompt_version,
        argument_public: r.chance(0.8) ? parent.row.argument_public : !parent.row.argument_public,
        created_at: iso(rt),
        kind: "revision",
        parent_debate_id: parent.row.id,
      },
      t: rt,
      user: slot.u,
      tier: parent.tier,
      parts: revisedParts,
      verdict,
    });
  }
  debates.sort((a, b) => a.t - b.t || a.row.id.localeCompare(b.row.id));
  const debateById = new Map(debates.map((d) => [d.row.id, d]));
  // Challenges, exchanges and reading answers belong to the base window.
  const originalsOf = new Map<string, WorkingDebate[]>();
  for (const d of debates) {
    if (d.row.kind !== "original" || d.t > to) continue;
    const list = originalsOf.get(d.user.id) ?? [];
    list.push(d);
    originalsOf.set(d.user.id, list);
  }

  // ---- 6. challenges ----
  const chRng = root.fork("challenges");
  const challenges: Item<ChallengeRow>[] = [];
  const challengeOfDebate = new Map<string, string>();
  const takenChallengees = new Set<string>();
  const nComplete = Math.round(cfg.challenges * 0.3);
  const nAccepted = Math.round(cfg.challenges * 0.2);
  const nOpen = cfg.challenges - nComplete - nAccepted;
  const userById = new Map(users.map((u) => [u.id, u]));
  // Complete: two people who argued the same motion around the same time,
  // the second having arrived through the first one's challenge link.
  const debaters = chRng.shuffle(users.filter((u) => u.cls !== "quiz" && u.n > 0));
  const links: Item<ChallengeLinkRow>[] = [];
  for (const b of debaters) {
    if (challenges.length >= nComplete) break;
    const bFirst = resultById.get(b.firstResultId)!;
    const bQuizAt = Date.parse(bFirst.row.created_at);
    const bOriginals = (originalsOf.get(b.id) ?? []).filter((d) => !d.row.rejected && !challengeOfDebate.has(d.row.id));
    let made = false;
    for (const bd of bOriginals.slice(0, 3)) {
      const candidates = users.filter(
        (a) => a.cls !== "quiz" && a.id !== b.id && a.signup < bQuizAt - HOUR
      );
      for (const a of chRng.shuffle(candidates).slice(0, 60)) {
        const ad = (originalsOf.get(a.id) ?? []).find(
          (d) =>
            d.row.topic_slug === bd.row.topic_slug &&
            !d.row.rejected &&
            !challengeOfDebate.has(d.row.id) &&
            d.t > bQuizAt + 5 * MINUTE &&
            Math.abs(d.t - bd.t) < 4 * DAY
        );
        if (!ad) continue;
        const aFirst = resultById.get(a.firstResultId)!;
        const aQuizAt = Date.parse(aFirst.row.created_at);
        const latest = bQuizAt - 5 * MINUTE;
        const earliest = Math.max(aQuizAt + 5 * MINUTE, latest - 2 * DAY);
        if (earliest >= latest) continue;
        const ct = earliest + chRng.next() * (latest - earliest);
        const cid = id(chRng);
        challenges.push({
          logicalId: `challenge:${challenges.length}`,
          rowId: cid,
          cohort: Math.max(a.n, b.n),
          row: {
            id: cid,
            challenger_result_id: aFirst.rowId,
            challengee_result_id: bFirst.rowId,
            status: "complete",
            topic_slug: bd.row.topic_slug,
            created_at: iso(ct),
            is_sample: true,
          },
        });
        bFirst.row.challenge_from = aFirst.rowId;
        bFirst.cohort = Math.max(bFirst.cohort, a.n);
        takenChallengees.add(bFirst.rowId);
        ad.row.challenge_id = cid;
        bd.row.challenge_id = cid;
        challengeOfDebate.set(ad.row.id, cid);
        challengeOfDebate.set(bd.row.id, cid);
        links.push({
          logicalId: `challenge-link:${challenges.length - 1}`,
          rowId: cid,
          cohort: Math.max(a.n, b.n),
          row: { id: cid, challenger_debate_id: ad.row.id, challengee_debate_id: bd.row.id },
        });
        made = true;
        break;
      }
      if (made) break;
    }
  }
  // Accepted: the other side took the quiz from the link and has not argued.
  const resultsByTime = [...quizResults].sort((x, y) => x.row.created_at.localeCompare(y.row.created_at));
  const challengerPool = resultsByTime.filter((x) => Date.parse(x.row.created_at) < to - 2 * DAY);
  let guard = 0;
  while (challenges.length < nComplete + nAccepted && guard++ < 20000) {
    const challenger = chRng.pick(challengerPool);
    const cAt = Date.parse(challenger.row.created_at) + chRng.int(1, 48 * 60) * MINUTE;
    // The challengee: an anonymous result, or a quiz-only account's first,
    // taken after the challenge was made.
    const eligibleChallengees = resultsByTime.filter((x) => {
      if (takenChallengees.has(x.rowId) || x.rowId === challenger.rowId) return false;
      const t = Date.parse(x.row.created_at);
      if (t <= cAt || t > cAt + 5 * DAY) return false;
      if (x.row.user_id === null) return true;
      const u = userById.get(x.row.user_id)!;
      return u.cls === "quiz" && x.rowId === u.firstResultId && x.row.user_id !== challenger.row.user_id;
    });
    if (eligibleChallengees.length === 0) continue;
    const challengee = chRng.pick(eligibleChallengees.slice(0, 40));
    const cid = id(chRng);
    challenges.push({
      logicalId: `challenge:${challenges.length}`,
      rowId: cid,
      cohort: Math.max(challenger.cohort, challengee.cohort),
      row: {
        id: cid,
        challenger_result_id: challenger.rowId,
        challengee_result_id: challengee.rowId,
        status: "accepted",
        topic_slug: null,
        created_at: iso(cAt),
        is_sample: true,
      },
    });
    challengee.row.challenge_from = challenger.rowId;
    challengee.cohort = Math.max(challengee.cohort, challenger.cohort);
    takenChallengees.add(challengee.rowId);
  }
  // Open: sent and never answered.
  while (challenges.length < nComplete + nAccepted + nOpen) {
    const challenger = chRng.pick(resultsByTime);
    const cAt = Math.min(to - MINUTE, Date.parse(challenger.row.created_at) + chRng.int(1, 48 * 60) * MINUTE);
    const cid = id(chRng);
    challenges.push({
      logicalId: `challenge:${challenges.length}`,
      rowId: cid,
      cohort: Math.max(challenger.cohort, cohortAt(cAt)),
      row: {
        id: cid,
        challenger_result_id: challenger.rowId,
        challengee_result_id: null,
        status: "open",
        topic_slug: null,
        created_at: iso(cAt),
        is_sample: true,
      },
    });
  }
  const challengeCohort = new Map(challenges.map((c) => [c.rowId, c.cohort]));

  // ---- 7. ratings and streaks, replayed in time order ----
  const replayed = replay(
    debates.map((d) => ({ row: d.row, t: d.t })),
    challenges.filter((c) => c.row.status === "complete").map((c) => ({
      id: c.rowId,
      challengerUser: resultById.get(c.row.challenger_result_id)!.row.user_id!,
      challengeeUser: resultById.get(c.row.challengee_result_id!)!.row.user_id!,
    })),
    TOPICS
  );

  // ---- 8. counterpart exchanges ----
  const exRng = root.fork("exchanges");
  const exchanges: Item<ExchangeRow>[] = [];
  const turns: Item<TurnRow>[] = [];
  const waiting = new Map<string, { d: WorkingDebate; at: number }[]>();
  const openPairs = new Set<string>();
  const optIn = debates.filter((d) => d.row.kind === "original" && !d.row.rejected && d.t <= to);
  const pOpt = Math.min(0.9, (cfg.exchanges * 2.4) / Math.max(1, optIn.length));
  const pairsMade: { a: WorkingDebate; b: WorkingDebate; at: number }[] = [];
  for (const d of optIn) {
    if (!exRng.chance(pOpt)) continue;
    const at = d.t + exRng.int(1, 30) * MINUTE;
    if (at > to - MINUTE) continue;
    const list = waiting.get(d.row.topic_slug) ?? [];
    const matchIdx = list.findIndex(
      (w) =>
        w.d.row.school !== d.row.school &&
        w.d.user.id !== d.user.id &&
        !openPairs.has([w.d.user.id, d.user.id].sort().join(":"))
    );
    if (matchIdx === -1) {
      list.push({ d, at });
      waiting.set(d.row.topic_slug, list);
      continue;
    }
    const [w] = list.splice(matchIdx, 1);
    pairsMade.push({ a: w.d, b: d, at });
    openPairs.add([w.d.user.id, d.user.id].sort().join(":"));
  }
  // 70% complete, 20% lapsed, 10% open. An open exchange has had a turn in
  // the last fortnight, so it is drawn from the ones that began in the
  // last four weeks; a lapsed one has not, so from the earlier ones.
  // Pairing ran over the whole window; keep a sample of it the size asked
  // for, in time order, so exchanges are spread as arguments are.
  const kept = new Set(exRng.shuffle(pairsMade.map((_, i) => i)).slice(0, Math.ceil(cfg.exchanges * 1.1)));
  const sampledPairs = pairsMade.filter((_, i) => kept.has(i));
  pairsMade.length = 0;
  pairsMade.push(...sampledPairs);
  const lateFrom = to - 28 * DAY;
  const late = pairsMade.filter((p) => p.at > lateFrom).length / Math.max(1, pairsMade.length);
  const pOpenIfLate = Math.min(1, 0.1 / Math.max(late, 0.1));
  const pLapsedIfEarly = Math.min(1, 0.2 / Math.max(1 - late, 0.2));
  for (const [pairIndex, { a, b, at }] of pairsMade.entries()) {
    if (exchanges.length >= cfg.exchanges) break;
    const r = exRng.fork(`x${pairIndex}`);
    const exId = id(r);
    const isLate = at > lateFrom;
    let outcome: "complete" | "lapsed" | "open" = isLate
      ? r.chance(pOpenIfLate) ? "open" : "complete"
      : r.chance(pLapsedIfEarly) ? "lapsed" : "complete";
    const wanted = outcome === "complete" ? MAX_SEQ : r.int(1, MAX_SEQ - 1);
    const exTurns: TurnRow[] = [];
    let tt = at;
    const textA = a.row.argument;
    const textB = b.row.argument;
    for (let seq = 1; seq <= wanted; seq++) {
      tt += Math.max(30 * MINUTE, Math.min(5 * DAY, r.exponential(18 * HOUR)));
      if (outcome === "lapsed" && tt > to - LAPSE_DAYS * DAY - HOUR) break;
      if (tt > to - MINUTE) break;
      const author = authorForSeq(seq, a.user.id, b.user.id) === a.user.id ? a : b;
      const other = author === a ? b : a;
      const source =
        quoteSourceForSeq(seq) === "argument" ? (other === a ? textA : textB) : exTurns[seq - 2].body;
      const turn = writeTurn({ ...banks, closings: closingsOf(author.row.topic_slug as TopicSlug) }, author, other, seq, source, r);
      exTurns.push({
        id: id(r),
        exchange_id: exId,
        author_id: author.user.id,
        seq,
        quoted_claim: turn.quote,
        body: turn.body,
        screen_result: "ok",
        screen_reason: "sample: written from a template, not screened by the model",
        created_at: iso(tt),
      });
    }
    if (exTurns.length === 0) continue; // nothing happened; leave no exchange
    // A slow exchange still going: its replies have come at intervals of
    // days, and the last one inside the fortnight.
    if (outcome === "open") {
      const lastAt = Date.parse(exTurns[exTurns.length - 1].created_at);
      const floor = to - LAPSE_DAYS * DAY + 2 * HOUR;
      if (lastAt < floor) {
        const target = Math.min(to - HOUR, floor + r.float(0, 10 * DAY));
        const shift = target - lastAt;
        exTurns.forEach((x, i) => {
          x.created_at = iso(Date.parse(x.created_at) + Math.round((shift * (i + 1)) / exTurns.length));
        });
      }
    }
    if (outcome === "complete" && exTurns.length < MAX_SEQ) outcome = "open";
    const last = Date.parse(exTurns[exTurns.length - 1].created_at);
    if (outcome === "open" && last < to - LAPSE_DAYS * DAY) outcome = "lapsed";
    if (outcome === "lapsed" && last >= to - LAPSE_DAYS * DAY) outcome = "open";
    const cohort = Math.max(a.user.n, b.user.n, debateCohort(a), debateCohort(b));
    exchanges.push({
      logicalId: `exchange:${exchanges.length}`,
      rowId: exId,
      cohort,
      row: {
        id: exId,
        topic_slug: a.row.topic_slug,
        debate_a: a.row.id,
        debate_b: b.row.id,
        user_a: a.user.id,
        user_b: b.user.id,
        school_a: a.row.school,
        school_b: b.row.school,
        status: outcome,
        publish_a: r.chance(0.3),
        publish_b: r.chance(0.3),
        next_turn:
          outcome === "open" ? authorForSeq(exTurns.length + 1, a.user.id, b.user.id) : null,
        last_turn_at: exTurns[exTurns.length - 1].created_at,
        created_at: iso(at),
        is_sample: true,
      },
    });
    exTurns.forEach((t) => turns.push({ logicalId: `turn:${exId}:${t.seq}`, rowId: t.id, cohort, row: t }));
  }
  function debateCohort(d: WorkingDebate): number {
    return Math.max(d.user.n, d.row.challenge_id ? challengeCohort.get(d.row.challenge_id)! : 0);
  }

  // ---- 9. reading responses ----
  const rdRng = root.fork("reading");
  const readingResponses: Item<ReadingResponseRow>[] = [];
  const responseBank = readingResponseBank as Record<string, string[][]>;
  const addReading = (u: User, topic: TopicSlug, before: number, r: Rng) => {
    const start = Math.max(u.signup + MINUTE, before - r.int(4, 40) * MINUTE);
    // Both answers, a few minutes apart, strictly before the argument.
    if (start + 5 * MINUTE >= before || start > to - 6 * MINUTE) return;
    for (const chunk of [0, 1]) {
      const rid = id(r);
      readingResponses.push({
        logicalId: `reading:${u.n}:${topic}:${chunk}`,
        rowId: rid,
        cohort: u.n,
        row: {
          id: rid,
          user_id: u.id,
          topic_slug: topic,
          chunk_index: chunk,
          response: r.pick(responseBank[topic][chunk]),
          created_at: iso(start + chunk * r.int(1, 4) * MINUTE),
        },
      });
    }
  };
  for (const u of users) {
    const r = rdRng.fork(`u${u.n}`);
    const firsts = new Map<string, number>();
    for (const d of originalsOf.get(u.id) ?? []) if (!firsts.has(d.row.topic_slug)) firsts.set(d.row.topic_slug, d.t);
    if (firsts.size) {
      for (const [topic, t] of firsts) if (r.chance(0.27)) addReading(u, topic as TopicSlug, t, r);
    } else if (r.chance(0.12)) {
      const t = u.signup + r.int(5, 120) * MINUTE;
      if (t < to) addReading(u, r.pick(TOPICS), t, r);
    }
  }

  // ---- 10. classes ----
  const clRng = root.fork("classes");
  const classes: Item<ClassRow>[] = [];
  const classMembers: Item<ClassMemberRow>[] = [];
  const owners = clRng.shuffle(users.filter((u) => u.cls === "quiz" && u.signup < from + 21 * DAY)).slice(0, cfg.classes);
  const inClass = new Set<string>(owners.map((o) => o.id));
  for (const [k, owner] of owners.entries()) {
    const created = owner.signup + clRng.int(60, 3 * 24 * 60) * MINUTE;
    if (created > to - DAY) continue;
    const cid = id(clRng);
    classes.push({
      logicalId: `class:${k}`,
      rowId: cid,
      cohort: owner.n,
      row: {
        id: cid,
        code: clRng.token(CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH),
        owner_id: owner.id,
        name: CLASS_NAMES[k % CLASS_NAMES.length],
        created_at: iso(created),
      },
    });
    const size = clRng.int(15, 30);
    const candidates = users.filter((u) => !inClass.has(u.id) && u.signup > created && u.signup < created + 10 * DAY);
    for (const m of clRng.shuffle(candidates).slice(0, size)) {
      inClass.add(m.id);
      const joined = Math.min(to - MINUTE, m.signup + clRng.int(5, 48 * 60) * MINUTE);
      classMembers.push({
        logicalId: `class-member:${k}:${m.n}`,
        rowId: `${cid}:${m.id}`,
        cohort: Math.max(owner.n, m.n),
        row: { class_id: cid, user_id: m.id, joined_at: iso(joined) },
      });
    }
  }

  // ---- 11. profiles, with what the replay ended on ----
  for (const item of weeklyResults) pushResult(item);
  // A weekly run's accounts joined by `to`, each as it stood then: a week is
  // drawn whole, so a retake later in the week is not yet theirs.
  const profileUsers = cfg.weekly ? [...users, ...weeklyUsers.filter((u) => u.signup <= horizon)] : users;
  const profiles: Item<ProfileRow>[] = profileUsers.map((u) => {
    const end = replayed.profiles.get(u.id);
    return {
      logicalId: `profile:${u.n}`,
      rowId: u.id,
      cohort: u.n,
      row: {
        id: u.id,
        handle: u.handle,
        display_name: u.displayName,
        created_at: iso(u.signup),
        school: cfg.weekly ? schoolOf(u, horizon) : u.schoolAt[u.schoolAt.length - 1].school,
        elo: end?.elo ?? 1200,
        streak: end?.streak ?? 0,
        streak_updated_on: end?.streakUpdatedOn ?? null,
        argument_default_public: u.defaultPublic,
        school_history: cfg.weekly ? u.history.filter((h) => Date.parse(h.at) <= horizon) : u.history,
        tz: u.tz,
        is_sample: true,
      },
    };
  });

  const debateItems: Item<DebateRow>[] = debates.map((d) => ({
    // o for an original, r for a revision: teardown deletes revisions first.
    logicalId: `debate:${d.row.kind === "original" ? "o" : "r"}:${d.user.n}:${d.row.id}`,
    rowId: d.row.id,
    cohort: Math.max(
      debateCohort(d),
      d.row.parent_debate_id ? debateCohort(debateById.get(d.row.parent_debate_id)!) : 0
    ),
    row: d.row,
  }));
  // Revisions after their parents, whatever their times: the insert order.
  debateItems.sort((x, y) => (x.row.kind === y.row.kind ? 0 : x.row.kind === "original" ? -1 : 1));

  return {
    runId,
    authUsers,
    profiles,
    // In time order, so a challenger's result is always written before the
    // result that names it in challenge_from.
    quizResults: [...quizResults].sort((x, y) => x.row.created_at.localeCompare(y.row.created_at) || x.rowId.localeCompare(y.rowId)),
    challenges,
    challengeLinks: links,
    debates: debateItems,
    exchanges,
    turns,
    readingResponses,
    classes,
    classMembers,
    sampleParElo: replayed.par,
  };
}

// An exchange turn: quotes the other side, and argues from the author's
// school with the passages the banks hold for exactly this pairing.
function writeTurn(
  banks: Banks,
  author: { row: DebateRow },
  other: { row: DebateRow },
  seq: number,
  source: string,
  r: Rng
): { quote: string; body: string } {
  const topic = author.row.topic_slug as TopicSlug;
  const fr = banks.fragments[topic];
  const mine = fr.schools[author.row.school];
  const theirs = fr.schools[other.row.school];
  const againstThem = theirs.objections.find((o) => o.rival === author.row.school);
  const answerToThem = mine.objections.find((o) => o.rival === other.row.school);
  let quote = "";
  for (let i = 0; i < 20; i++) {
    const q = quoteFrom(source, r);
    if (!checkQuote(q, source)) {
      quote = q;
      break;
    }
  }
  if (!quote) quote = source.split(/\s+/).slice(0, 8).join(" ");
  const reason = r.pick(mine.reasons);
  let body: string;
  // Among six schools a pair can have no objection between them; then the
  // opening turn argues from a reason, and the reply from a reason and an
  // example, rather than either saying one reason twice. Among quiz v1's
  // three every pair has one, so those turns are as they were.
  if (seq === 1) body = againstThem ? `That is where I disagree. ${capital(againstThem.claim)} ${reason}` : `That is where I disagree. ${reason}`;
  else if (seq === 2) body = answerToThem ? `${capital(answerToThem.answer)} ${reason}` : `${reason} ${r.pick(mine.examples)}`;
  else if (seq === 3) body = `That reply does not settle it. ${reason} ${r.pick(mine.examples)}`;
  else body = `${reason} ${r.pick(banks.closings[author.row.school])}`;
  body = body.replace(/\s+/g, " ").trim();
  if (checkBody(body)) body = `${body} ${objectionSentence(r.pick(mine.objections))}`.slice(0, 1150);
  return { quote, body };
}

// The slips people make typing fast. Applied to about one argument in
// twelve, never inside a phrase the verdict quotes, so the quote still
// matches the argument exactly.
// Exported for src/lib/exemplars.ts's test: an exemplar is never one of these.
export const TYPOS: [RegExp, string][] = [
  [/\bbecause\b/, "becuase"],
  [/\bdefinitely\b/, "definately"],
  [/\btheir\b/, "thier"],
  [/\bwhich\b/, "wich"],
  [/\bargument\b/, "arguement"],
  [/\breally\b/, "realy"],
  [/\bdoesn't\b/, "doesnt"],
  [/\bit's\b/, "its"],
  [/\bseparate\b/, "seperate"],
  [/\bresponsible\b/, "responsable"],
  [/\bthe\b/, "the the"],
  [/\bwhether\b/, "wether"],
];

function withTypos(text: string, verdict: Verdict | null, r: Rng): string {
  if (!r.chance(0.08)) return text;
  const quoted = verdict
    ? [verdict.strongest_move, verdict.weakest_move].flatMap((s) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
    : [];
  const protectedSpans = quoted
    .map((q) => {
      const at = text.indexOf(q);
      return at === -1 ? null : ([at, at + q.length] as const);
    })
    .filter((x): x is readonly [number, number] => x !== null);
  let out = text;
  for (const [pattern, replacement] of r.shuffle(TYPOS).slice(0, r.int(1, 2))) {
    const m = pattern.exec(out);
    if (!m) continue;
    const at = m.index;
    if (protectedSpans.some(([a, b]) => at < b && at + m[0].length > a)) continue;
    const next = out.slice(0, at) + replacement + out.slice(at + m[0].length);
    // Only a change of the same length keeps the protected spans in place.
    if (replacement.length !== m[0].length && protectedSpans.some(([a]) => a > at)) continue;
    out = next;
  }
  return quoted.every((q) => out.includes(q)) && wordCount(out) <= 250 ? out : text;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
