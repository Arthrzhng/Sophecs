// The dataset: every row a seed run writes, generated in memory from a seed
// and a window, before anything is written anywhere. Pure: the same config
// gives the same rows, in the same order, with the same ids.
//
// What it reuses from the app rather than reimplementing:
// - the quiz bank and scoreQuiz, so a sample's school comes out of answers
//   it gave, as a reader's does (answers are biased, outcomes are not set);
// - soloElo, pairwiseElo and applyStreakDay, replayed in time order
//   (replay.ts), with a par of its own so no genuine topic par is read or
//   written;
// - checkQuote and checkBody for every exchange turn;
// - getWeeklyMotion, so most arguments are on the motion of their week;
// - the seven-day topic lock and the five-a-day limit /api/judge applies.
//
// docs/sample-activity.md describes the model and its parameters.

import { QUIZ_QUESTIONS, type QuizOption } from "../../content/quiz/questions";
import { scoreQuiz } from "../../src/lib/scoring";
import { checkBody, checkQuote, authorForSeq, quoteSourceForSeq, LAPSE_DAYS, MAX_SEQ } from "../../src/lib/counterpart";
import { getWeeklyMotion } from "../../src/lib/weekly-motion";
import { Rng, ID_ALPHABET, ID_LENGTH, CLASS_CODE_ALPHABET, CLASS_CODE_LENGTH } from "./rng";
import {
  SCHOOLS,
  TOPICS,
  compose,
  fit,
  FRAMES,
  wordCount,
  quoteFrom,
  objectionSentence,
  type Banks,
  type BankArgument,
  type Parts,
  type SchoolId,
  type Tier,
  type TopicSlug,
} from "./banks";
import { templateVerdict, templateRevisionVerdict, templateRejection, type Verdict, type Rejection } from "./verdicts";
import { replay } from "./replay";
import { DAY, HOUR, MINUTE, TIMEZONES, activeTimeOn, dayWeight, iso, startOfUtcDay } from "./time";
import { GIVEN_NAMES, INITIALS, CLASS_NAMES } from "./names";
import readingResponseBank from "./reading-responses.json";

// Bumped whenever the same plan inputs would give different rows, so an
// older plan is refused by name rather than by a hash mismatch.
export const GENERATOR_VERSION = "sample-activity-2";

export interface GenConfig {
  seed: number;
  from: string; // ISO, inclusive
  to: string; // ISO, frozen in the plan
  users: number;
  anonResults: number;
  challenges: number;
  exchanges: number;
  classes: number;
  topics: { slug: string; title: string; motion: string; sort: number; microBefore: string }[];
}

export const DEFAULTS = {
  users: 4000,
  anonResults: 6000,
  challenges: 400,
  exchanges: 600,
  classes: 12,
  from: "2026-09-18T00:00:00.000Z",
};

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
  vector: Record<SchoolId, number>;
  answers: { q: number; opt: string }[];
  challenge_from: string | null;
  referrer: string;
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

export function runIdFor(seed: number, to: string): string {
  const stamp = to.replace(/[-:T]/g, "").slice(0, 12); // yyyymmddhhmm
  return `sample-${seed}-${stamp}`;
}

export function emailFor(runId: string, n: number): string {
  return `seed+${runId}-${n}@sophecs.test`;
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
  base: BankArgument;
  parts: Parts;
  verdict: Verdict | null;
}

const REFERRERS: [string, number][] = [
  ["https://www.tiktok.com/", 0.3],
  ["https://l.instagram.com/", 0.2],
  ["https://t.co/", 0.1],
  ["", 0.4],
];

export function generate(cfg: GenConfig, banks: Banks): Dataset {
  const from = Date.parse(cfg.from);
  const to = Date.parse(cfg.to);
  if (!(to > from)) throw new Error("the window ends before it starts");
  const runId = runIdFor(cfg.seed, cfg.to);
  // The window is part of the root: the same seed with another end gives
  // other ids, so a new plan never collides with a torn-down run's ids,
  // which the registry keeps for its audit.
  const root = new Rng(`sophecs-sample/${GENERATOR_VERSION}/${cfg.seed}/${cfg.from}/${cfg.to}`);
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

  // ---- 2. the quiz: answers biased by a leaning, outcomes by scoreQuiz ----
  const quizRng = root.fork("quiz-calibration");
  const target: Record<SchoolId, number> = { stoicism: 0.4, utilitarianism: 0.35, "virtue-ethics": 0.25 };
  const answer = (r: Rng, leaning: SchoolId, strength: number): QuizOption[] =>
    QUIZ_QUESTIONS.map((q) => r.weighted(q.options.map((o) => [o, Math.exp(3 * strength * o.vector[leaning])] as const)));
  // Leanings are weighted so that outcomes land near the target mix; the
  // weights are found on a calibration sample, deterministically.
  let leanWeights = { ...target };
  for (let iter = 0; iter < 4; iter++) {
    const counts: Record<SchoolId, number> = { stoicism: 0, utilitarianism: 0, "virtue-ethics": 0 };
    const r = quizRng.fork(`iter-${iter}`);
    for (let i = 0; i < 3000; i++) {
      const lean = r.weighted(SCHOOLS.map((s) => [s, leanWeights[s]] as const));
      counts[scoreQuiz(answer(r, lean, r.float(0.4, 1.4))).primary as SchoolId]++;
    }
    leanWeights = Object.fromEntries(
      SCHOOLS.map((s) => [s, leanWeights[s] * (target[s] / Math.max(0.01, counts[s] / 3000))])
    ) as Record<SchoolId, number>;
  }
  const takeQuiz = (r: Rng, lean: SchoolId) => {
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
  const users: User[] = rawUsers.map((u, n) => {
    const r = u.r;
    const given = r.pick(GIVEN_NAMES);
    const initial = r.pick(INITIALS.split(""));
    let handle = `${given.toLowerCase()}_${initial.toLowerCase()}${r.int(10, 9999)}`;
    while (usedHandles.has(handle)) handle = `${handle}${r.int(0, 9)}`;
    usedHandles.add(handle);
    const leaning = r.weighted(SCHOOLS.map((s) => [s, leanWeights[s]] as const));
    return {
      n,
      id: r.uuid(),
      rng: r,
      signup: u.signup,
      tz: u.tz,
      cls: cls[n],
      skill: Math.min(1, Math.max(0, r.normal(0.5, 0.2))),
      defaultPublic: r.chance(0.35),
      displayName: `${given} ${initial}.`,
      handle,
      leaning,
      firstResultId: "",
      schoolAt: [],
      history: [],
    };
  });

  const authUsers: Item<AuthUserRow>[] = users.map((u) => ({
    logicalId: `user:${u.n}`,
    rowId: u.id,
    cohort: u.n,
    row: { id: u.id, email: emailFor(runId, u.n) },
  }));

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
        referrer: r.weighted(REFERRERS),
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
        const lean = r.pick(SCHOOLS.filter((s) => s !== current));
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
          referrer: "",
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
    const lean = r.weighted(SCHOOLS.map((s) => [s, leanWeights[s]] as const));
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
        referrer: r.weighted(REFERRERS),
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
  const debateRng = root.fork("debates");
  const debates: WorkingDebate[] = [];
  const weeklyTopics = cfg.topics.map((t) => ({ slug: t.slug, title: t.title, sort: t.sort }));
  const pickTier = (r: Rng, skill: number): Tier => {
    const shift = 0.3 * (skill - 0.5);
    return r.weighted([
      ["strong", 0.25 + shift],
      ["mid", 0.5],
      ["weak", 0.25 - shift],
    ] as const);
  };
  const vary = (r: Rng, base: BankArgument): Parts => {
    const s = banks.fragments[base.topic].schools[base.school];
    const p: Parts = { ...base.parts, reasons: [...base.parts.reasons], objections: [...base.parts.objections], weak: [...base.parts.weak] };
    if (r.chance(0.5)) p.position = r.int(0, s.positions.length - 1);
    if (r.chance(0.5)) p.frame = r.int(0, FRAMES.length - 1);
    if (p.example !== null && r.chance(0.6)) p.example = r.int(0, s.examples.length - 1);
    if (p.closing !== null && r.chance(0.6)) p.closing = r.int(0, banks.closings[base.school].length - 1);
    if (p.weak.length === 2 && r.chance(0.5)) p.weak.reverse();
    if (p.reasons.length === 2 && r.chance(0.3)) p.reasons.reverse();
    const textOf = (x: Parts) => compose(banks.fragments[base.topic], banks.closings, base.school, x);
    if (p.example !== null && p.reasons.length > 0 && r.chance(0.15)) {
      const dropped = { ...p, example: null };
      if (wordCount(textOf(dropped)) >= 80) return dropped;
    }
    if (wordCount(textOf(p)) > 250 && p.frame !== undefined) delete p.frame;
    if (wordCount(textOf(p)) > 250 || wordCount(textOf(p)) < 80) return base.parts;
    return p;
  };

  for (const u of users) {
    if (u.cls === "quiz") continue;
    const r = debateRng.fork(`u${u.n}`);
    // About 15% of debaters revise: half the heavy users, and one in
    // eight of the rest.
    const reviser = r.chance(u.cls === "heavy" ? 0.5 : 0.125);
    let total =
      u.cls === "light"
        ? r.weighted([[1, 0.5], [2, 0.3], [3, 0.2]] as const)
        : u.cls === "regular"
          ? Math.min(29, 4 + Math.round(r.exponential(7)))
          : r.int(30, 36);
    // A light reader who revises wrote an original to revise.
    if (reviser && u.cls === "light" && total === 1) total = 2;
    const revisions = reviser
      ? u.cls === "light"
        ? 1
        : u.cls === "regular"
          ? r.int(1, Math.min(3, total - 1))
          : r.int(2, 6)
      : 0;
    const originalsWanted = total - revisions;
    // Most people drop off within a fortnight; regulars last longer and
    // heavy users stay to the end of the window.
    const span =
      u.cls === "light"
        ? Math.min(20 * DAY, Math.max(0.05 * DAY, r.exponential(4 * DAY)))
        : u.cls === "regular"
          ? 6 * DAY + r.exponential(14 * DAY)
          : to - u.signup;
    const end = Math.min(to - 5 * MINUTE, u.signup + span);
    const mine: WorkingDebate[] = [];
    const lockedUntil = new Map<string, number>();
    const recent: number[] = [];
    let t = u.signup + r.int(3, 45) * MINUTE;
    let attempts = 0;
    while (mine.length < originalsWanted && t < end && attempts < 2000) {
      attempts++;
      // Five a day, as /api/judge counts them: within any 24 hours.
      while (recent.length && recent[0] <= t - DAY) recent.shift();
      if (recent.length >= 5) {
        t = recent[0] + DAY + r.int(5, 120) * MINUTE;
        continue;
      }
      const weekly = getWeeklyMotion(weeklyTopics, new Date(t))!.slug as TopicSlug;
      const open = TOPICS.filter((s) => (lockedUntil.get(s) ?? 0) <= t);
      if (open.length === 0) {
        t = Math.min(...[...lockedUntil.values()]) + r.int(30, 600) * MINUTE;
        continue;
      }
      const topic = open.includes(weekly) && r.chance(0.6) ? weekly : r.pick(open);
      const school = schoolOf(u, t);
      const progress = Math.min(1, (t - u.signup) / (30 * DAY));
      const tier = pickTier(r, Math.min(1, u.skill + (u.cls === "heavy" ? 0.15 * progress : 0)));
      const pool = banks.arguments[`${topic}.${school}`].filter((a) => a.tier === tier);
      const base = r.pick(pool);
      const parts = vary(r, base);
      const rejectChance = tier === "weak" ? 0.06 : tier === "mid" ? 0.024 : 0.01;
      const rejected = r.chance(rejectChance);
      const fr = banks.fragments[topic];
      const verdict = rejected ? null : templateVerdict(fr, { school, tier }, parts, u.skill, r);
      const rejection = rejected ? templateRejection(r) : null;
      const rid = id(r);
      const topicRow = topicBySlug.get(topic)!;
      const row: DebateRow = {
        id: rid,
        user_id: u.id,
        topic_slug: topic,
        challenge_id: null,
        school,
        argument: withTypos(compose(fr, banks.closings, school, parts), verdict, r),
        rejected,
        rejection_reason: null,
        verdict: verdict ?? rejection!,
        score: verdict ? verdict.score : null,
        prompt_version: (verdict ?? rejection!).prompt_version,
        argument_public: r.chance(0.1) ? !u.defaultPublic : u.defaultPublic,
        elo_before: null,
        elo_after: null,
        elo_recomputed_at: null,
        created_at: iso(t),
        kind: "original",
        parent_debate_id: null,
        seeking_counterpart_at: null,
        motion_text: topicRow.motion,
        is_sample: true,
        verdict_is_template: true,
      };
      if (rejection) row.rejection_reason = rejection.rejection_reason;
      mine.push({ row, t, user: u, tier, base, parts, verdict });
      lockedUntil.set(topic, t + 7 * DAY + MINUTE);
      recent.push(t);
      // The next argument: often the same sitting, otherwise a later day,
      // with long gaps more likely as interest fades.
      if (r.chance(u.cls === "light" ? 0.35 : 0.45)) t += r.int(4, 30) * MINUTE;
      else {
        const gapDays = u.cls === "heavy" ? r.exponential(0.6) : u.cls === "regular" ? r.exponential(1.8) : r.exponential(2.5);
        let next: number | null = null;
        const firstDay = startOfUtcDay(t + Math.max(u.cls === "heavy" ? 0 : 1, Math.round(gapDays)) * DAY);
        for (let k = 0; k < 4 && next === null; k++) next = activeTimeOn(r, u.tz, firstDay + k * DAY, t + 10 * MINUTE, end);
        t = next ?? end + 1;
      }
    }
    // Revisions: answer the objection the verdict named, some time later.
    const eligible = r.shuffle(mine.filter((d) => d.verdict && d.verdict.unanswered_objection));
    const revs: WorkingDebate[] = [];
    for (const parent of eligible.slice(0, revisions)) {
      const rt = parent.t + Math.max(10 * MINUTE, Math.min(6 * DAY, r.exponential(DAY)));
      if (rt > to - MINUTE) continue;
      const fr = banks.fragments[parent.row.topic_slug as TopicSlug];
      const s = fr.schools[parent.row.school];
      const answeredIdx = s.objections.findIndex((o) => o.rival === parent.verdict!.unanswered_objection!.school);
      const answered = r.chance(0.85);
      const revisedParts = fit(fr, banks.closings, parent.row.school, {
        ...parent.parts,
        objections: [...parent.parts.objections, answeredIdx],
      });
      const verdict = templateRevisionVerdict(
        fr,
        parent.row.school,
        parent.tier,
        parent.verdict!,
        revisedParts,
        answeredIdx,
        answered,
        r
      );
      const rid = id(r);
      revs.push({
        row: {
          ...parent.row,
          id: rid,
          challenge_id: null,
          argument: compose(fr, banks.closings, parent.row.school, revisedParts),
          rejected: false,
          rejection_reason: null,
          verdict,
          score: verdict.score,
          argument_public: r.chance(0.8) ? parent.row.argument_public : !parent.row.argument_public,
          created_at: iso(rt),
          kind: "revision",
          parent_debate_id: parent.row.id,
        },
        t: rt,
        user: u,
        tier: parent.tier,
        base: parent.base,
        parts: revisedParts,
        verdict,
      });
    }
    debates.push(...mine, ...revs);
  }
  debates.sort((a, b) => a.t - b.t || a.row.id.localeCompare(b.row.id));
  const debateById = new Map(debates.map((d) => [d.row.id, d]));
  const originalsOf = new Map<string, WorkingDebate[]>();
  for (const d of debates) {
    if (d.row.kind !== "original") continue;
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
  const challengeUrl = (cid: string) => `https://sophecs.com/c/${cid}`;
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
        bFirst.row.referrer = challengeUrl(cid);
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
    challengee.row.referrer = challengeUrl(cid);
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
  const optIn = debates.filter((d) => d.row.kind === "original" && !d.row.rejected);
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
      const turn = writeTurn(banks, author, other, seq, source, r);
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
  const profiles: Item<ProfileRow>[] = users.map((u) => {
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
        school: u.schoolAt[u.schoolAt.length - 1].school,
        elo: end?.elo ?? 1200,
        streak: end?.streak ?? 0,
        streak_updated_on: end?.streakUpdatedOn ?? null,
        argument_default_public: u.defaultPublic,
        school_history: u.history,
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
  if (seq === 1) body = `That is where I disagree. ${capital(againstThem?.claim ?? reason)} ${reason}`;
  else if (seq === 2) body = `${capital(answerToThem ? answerToThem.answer : reason)} ${reason}`;
  else if (seq === 3) body = `That reply does not settle it. ${reason} ${r.pick(mine.examples)}`;
  else body = `${reason} ${r.pick(banks.closings[author.row.school])}`;
  body = body.replace(/\s+/g, " ").trim();
  if (checkBody(body)) body = `${body} ${objectionSentence(r.pick(mine.objections))}`.slice(0, 1150);
  return { quote, body };
}

// The slips people make typing fast. Applied to about one argument in
// twelve, never inside a phrase the verdict quotes, so the quote still
// matches the argument exactly.
const TYPOS: [RegExp, string][] = [
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
