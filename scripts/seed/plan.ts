// The plan: everything a run will do, written before it does anything.
// Execution regenerates the dataset from the plan's own parameters and
// refuses to start unless the regenerated manifest hashes to the value in
// the plan, so the rows written are exactly the rows that were approved.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { GENERATOR_VERSION, WEEKLY_RULES_SHIPPED, generate, weeklyRules, type Dataset, type GenConfig } from "./generate";
import { phases } from "./engine";
import { loadBanks, wordCount, type Banks } from "./banks";

export const PLAN_VERSION = 2;

export interface Plan {
  planVersion: number;
  runId: string;
  target: { kind: "local"; database: string } | { kind: "production"; projectRef: string };
  createdAt: string;
  codeVersion: string;
  generatorVersion: string;
  /** Secret in production. Never printed; kept only in the plan file on the operator's machine. */
  seed: string;
  window: { from: string; baseTo: string; to: string };
  config: Omit<GenConfig, "topics" | "seed" | "from" | "baseTo" | "to">;
  topics: { slug: string; motion: string }[];
  /** The run's identity: generator, seed, base window, config and motions. Unchanged as `to` moves. */
  baseHash: string;
  manifestHash: string;
  counts: Record<string, number>;
  distributions: Record<string, unknown>;
  prerequisites: string[];
  effects: Record<string, unknown>;
  runtime: Record<string, unknown>;
  costs: Record<string, unknown>;
  validation: string[];
  recovery: string[];
  commands: Record<string, string>;
}

export function manifestHash(ds: Dataset): string {
  const h = createHash("sha256");
  h.update(`${ds.runId}\n`);
  for (const p of phases(ds)) for (const it of p.items) h.update(JSON.stringify([p.kind, it.logicalId, it.rowId, it.cohort, it.row]) + "\n");
  for (const l of ds.challengeLinks) h.update(JSON.stringify(["link", l.logicalId, l.rowId, l.cohort, l.row]) + "\n");
  return h.digest("hex");
}

/**
 * The fixed part of a plan, hashed: what makes two plans the same run.
 * Stored in seed_runs.plan_hash, which only the server role can read. It
 * is never printed, since with the public generator it would let a seed
 * be checked by guessing.
 */
// A run made before WEEKLY_RULES_FROM (generate.ts) hashes the weekly
// shape it was made with, the three fields of Arthur's 2026-11-09
// decisions left out: they reach its weeks from WEEKLY_RULES_WEEK by this
// code, as score rule 2 reached rows from SCORE_RULE_2_FROM, and its base
// window not at all. Only at the values they shipped with: any other
// value is hashed, so it is refused before a write (review pass 3, O3).
function hashedWeekly(gen: GenConfig): NonNullable<GenConfig["weekly"]> {
  const w = gen.weekly!;
  if (!weeklyRules(gen).madeBefore) return w;
  const none = w.rolling === undefined && w.anonymous === undefined && w.taperDays === undefined;
  const shipped = w.rolling === WEEKLY_RULES_SHIPPED.rolling && w.anonymous === WEEKLY_RULES_SHIPPED.anonymous && w.taperDays === WEEKLY_RULES_SHIPPED.taperDays;
  if (!none && !shipped) return w;
  return { newcomers: w.newcomers, active: w.active, minPerSchool: w.minPerSchool };
}

export function baseHash(gen: GenConfig): string {
  const fixed = {
    generator: GENERATOR_VERSION,
    seed: gen.seed,
    from: gen.from,
    baseTo: gen.baseTo,
    // The quiz only when a run names one, so every plan made before it
    // hashes as it did.
    config: {
      users: gen.users,
      anonResults: gen.anonResults,
      challenges: gen.challenges,
      exchanges: gen.exchanges,
      classes: gen.classes,
      ...(gen.quiz ? { quiz: gen.quiz } : {}),
      ...(gen.weekly ? { weekly: hashedWeekly(gen) } : {}),
    },
    topics: gen.topics.map((t) => [t.slug, t.motion]),
  };
  return createHash("sha256").update(JSON.stringify(fixed)).digest("hex");
}

export function counts(ds: Dataset): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(phases(ds).map((p) => [p.kind, p.items.length]));
  out.challenge_link = ds.challengeLinks.length;
  return out;
}

const share = (n: number, d: number) => Math.round((1000 * n) / Math.max(1, d)) / 10;

function shingles(text: string): Set<string> {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/** Distributions of a dataset, measured, for the plan and the docs. */
export function describe(ds: Dataset): Record<string, unknown> {
  const deb = ds.debates.map((d) => d.row);
  const perUser = new Map<string, number>();
  for (const d of deb) perUser.set(d.user_id, (perUser.get(d.user_id) ?? 0) + 1);
  const users = ds.profiles.length;
  const c = [...perUser.values()];
  const bucket = (lo: number, hi: number) => c.filter((x) => x >= lo && x <= hi).length;
  const revisers = new Set(deb.filter((d) => d.kind === "revision").map((d) => d.user_id)).size;
  const scored = deb.filter((d) => d.score !== null).map((d) => Number(d.score));
  const words = deb.map((d) => wordCount(d.argument));
  const textCount = new Map<string, number>();
  for (const d of deb) textCount.set(d.argument, (textCount.get(d.argument) ?? 0) + 1);
  const exactDup = deb.filter((d) => textCount.get(d.argument)! > 1).length;
  // Near duplicates: same motion and school, at least 80% of five-word
  // shingles shared, not identical.
  const groups = new Map<string, { text: string; sh: Set<string> }[]>();
  for (const [text] of textCount) {
    const d = deb.find((x) => x.argument === text)!;
    const k = `${d.topic_slug}.${d.school}`;
    const g = groups.get(k) ?? [];
    g.push({ text, sh: shingles(text) });
    groups.set(k, g);
  }
  const near = new Set<string>();
  for (const g of groups.values())
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        if (jaccard(g[i].sh, g[j].sh) >= 0.8) {
          near.add(g[i].text);
          near.add(g[j].text);
        }
  const nearDup = deb.filter((d) => near.has(d.argument) && textCount.get(d.argument)! === 1).length;
  const tally = <T,>(xs: T[]) => {
    const m: Record<string, number> = {};
    for (const x of xs) m[String(x)] = (m[String(x)] ?? 0) + 1;
    return m;
  };
  const signup = new Map(ds.profiles.map((p) => [p.row.id, Date.parse(p.row.created_at)]));
  const last = new Map<string, number>();
  for (const d of deb) last.set(d.user_id, Math.max(last.get(d.user_id) ?? 0, Date.parse(d.created_at)));
  const retained = [...last].filter(([u, t]) => t - signup.get(u)! > 14 * 86_400_000).length;
  const rr = ds.readingResponses.map((r) => r.row.response);
  const rrCount = new Map<string, number>();
  for (const r of rr) rrCount.set(r, (rrCount.get(r) ?? 0) + 1);
  return {
    quizSchoolsAllResultsPct: Object.fromEntries(
      Object.entries(tally(ds.quizResults.map((q) => q.row.school))).map(([k, v]) => [k, share(v, ds.quizResults.length)])
    ),
    profileSchoolsPct: Object.fromEntries(
      Object.entries(tally(ds.profiles.map((p) => p.row.school))).map(([k, v]) => [k, share(v, users)])
    ),
    accountsByDebatesPct: {
      quizOnly: share(users - c.length, users),
      "1-3": share(bucket(1, 3), users),
      "4-29": share(bucket(4, 29), users),
      "30+": share(bucket(30, 9999), users),
    },
    debatersWhoRevisePct: share(revisers, c.length),
    debates: { originals: deb.filter((d) => d.kind === "original").length, revisions: deb.filter((d) => d.kind === "revision").length },
    rejectedPct: share(deb.filter((d) => d.rejected).length, deb.length),
    scoreBandsPct: {
      "70-90": share(scored.filter((s) => s >= 70).length, scored.length),
      "50-69": share(scored.filter((s) => s >= 50 && s < 70).length, scored.length),
      "25-49": share(scored.filter((s) => s < 50).length, scored.length),
    },
    words: { min: Math.min(...words), max: Math.max(...words), mean: Math.round(words.reduce((a, b) => a + b, 0) / words.length) },
    exactDuplicateArgumentsPct: share(exactDup, deb.length),
    argumentsWithATypoPct: share(
      deb.filter((d) => /\b(becuase|definately|thier|wich|arguement|realy|doesnt|seperate|responsable|wether|the the)\b/.test(d.argument)).length,
      deb.length
    ),
    distinctArgumentTexts: textCount.size,
    nearDuplicateArgumentsPct: share(nearDup, deb.length),
    readingResponsesSharingTextPct: share(rr.filter((r) => rrCount.get(r)! > 1).length, rr.length),
    quizResultsWithAReferrer: ds.quizResults.filter((q) => q.row.referrer !== null).length,
    timezonesPct: Object.fromEntries(Object.entries(tally(ds.profiles.map((p) => p.row.tz))).map(([k, v]) => [k, share(v, users)])),
    debatersActiveAfter14DaysPct: share(retained, last.size),
    exchangeOutcomes: tally(ds.exchanges.map((e) => e.row.status)),
    challengeStatuses: tally(ds.challenges.map((x) => x.row.status)),
    classSizes: ds.classes.map((k) => ds.classMembers.filter((m) => m.row.class_id === k.rowId).length),
    schoolSwitches: {
      once: ds.profiles.filter((p) => p.row.school_history.length === 1).length,
      twice: ds.profiles.filter((p) => p.row.school_history.length === 2).length,
    },
    sampleParElo: ds.sampleParElo,
    eloRange: [Math.min(...ds.profiles.map((p) => p.row.elo)), Math.max(...ds.profiles.map((p) => p.row.elo))],
  };
}

function approxBytes(ds: Dataset): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of phases(ds)) out[p.kind] = p.items.reduce((s, i) => s + JSON.stringify(i.row).length, 0);
  return out;
}

export function codeVersion(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "scripts/seed", "content"], { encoding: "utf8" }).trim();
    return dirty ? `${sha}+uncommitted` : sha;
  } catch {
    return "unknown";
  }
}

export interface PlanInput {
  target: Plan["target"];
  gen: GenConfig;
  planPath: string;
  measured?: { rowsPerSecond?: number; authUsersPerSecond?: number; source: string };
}

export function buildPlan(input: PlanInput, banks: Banks = loadBanks()): { plan: Plan; dataset: Dataset } {
  const ds = generate(input.gen, banks);
  const n = counts(ds);
  const totalRows = Object.entries(n).filter(([k]) => k !== "auth_user").reduce((s, [, v]) => s + v, 0);
  const rowsPerSecond = input.measured?.rowsPerSecond ?? 150;
  const authPerSecond = input.measured?.authUsersPerSecond ?? 4;
  const bytes = approxBytes(ds);
  const totalBytes = Object.values(bytes).reduce((a, b) => a + b, 0);
  const prod = input.target.kind === "production";
  const ref = prod ? (input.target as { projectRef: string }).projectRef : "";
  const flags = prod
    ? `--expected-project-ref ${ref} --confirm-production ${ref} --run-id ${ds.runId} --plan ${input.planPath}`
    : `--run-id ${ds.runId} --plan ${input.planPath}`;
  const script = prod ? "production" : "local";
  const plan: Plan = {
    planVersion: PLAN_VERSION,
    runId: ds.runId,
    target: input.target,
    createdAt: new Date().toISOString(),
    codeVersion: codeVersion(),
    generatorVersion: GENERATOR_VERSION,
    seed: input.gen.seed,
    window: { from: input.gen.from, baseTo: input.gen.baseTo, to: input.gen.to },
    config: {
      users: input.gen.users,
      anonResults: input.gen.anonResults,
      challenges: input.gen.challenges,
      exchanges: input.gen.exchanges,
      classes: input.gen.classes,
      ...(input.gen.quiz ? { quiz: input.gen.quiz } : {}),
      ...(input.gen.weekly ? { weekly: input.gen.weekly } : {}),
    },
    topics: input.gen.topics.map((t) => ({ slug: t.slug, motion: t.motion })),
    baseHash: baseHash(input.gen),
    manifestHash: manifestHash(ds),
    counts: n,
    distributions: describe(ds),
    prerequisites: [
      "Migration 0023_sample_activity applied to the target (checked before any write).",
      "The code that reads is_sample deployed (labels, table note, par-window filter in /api/judge, challenge guard).",
      "debate_topics on the target matches the plan's six motions (checked before any write).",
      prod
        ? ".env.seed.production holds SEED_SUPABASE_URL and SEED_SUPABASE_SERVICE_ROLE_KEY for this project, on the machine that runs the command, with network access to the project."
        : ".env.seed.local holds SEED_LOCAL_DATABASE_URL for a Postgres on this machine.",
      prod ? "Auth settings checked: no auth hook or custom SMTP that would act on admin-created users." : "",
      "No other seed run holds a lock (checked before any write).",
    ].filter(Boolean),
    effects: {
      authUsers: n.auth_user,
      rowsByTable: Object.fromEntries(phases(ds).filter((p) => p.table).map((p) => [p.table, p.items.length])),
      challengeLinksUpdated: n.challenge_link,
      approxRowBytes: totalBytes,
      approxRowBytesByKind: bytes,
      writesOutside: "None. debate_topics, ai_calls, reports, blocks, payments and analytics are not written. No email is sent; no event is emitted.",
    },
    runtime: {
      estimateSeconds: Math.round(n.auth_user / authPerSecond + totalRows / rowsPerSecond),
      basis: input.measured
        ? `${input.measured.source}: ${rowsPerSecond.toFixed(0)} rows/s, ${authPerSecond.toFixed(1)} auth users/s`
        : `assumed: ${rowsPerSecond} rows/s and ${authPerSecond} auth users/s until a canary measures them`,
    },
    costs: {
      paidApiCalls: 0,
      note: "No model call is made: verdicts are templates. On Supabase's free plan the run adds database rows and auth users within the plan's limits; nothing is billed.",
    },
    validation: [
      "Every registry item for the run is created, and every row reads back marked and owned.",
      "Sample rows per table equal the registry's created items across runs.",
      "Spot checks: 50 rows per kind read back equal to the plan's rows.",
      "Every stored sample debate's score and prompt_version equal the plan's.",
      "Rule-2 scores land on a multiple of 5 no more than 20% of the time, for the composite and each criterion, once there are 1,000.",
      "No sample debate is waiting for a counterpart (seeking_counterpart_at is null).",
      "Genuine rows not removed; genuine profiles' ratings, streaks and schools unchanged; debate_topics par unchanged; elo_percentile(1200) unchanged.",
      prod ? "Auth spot check: 20 sample users are banned, carry this run's id, and have the planned email." : "",
    ].filter(Boolean),
    recovery: [
      "Cancel with Ctrl-C: the current batch finishes, the lock is released, and the same command resumes.",
      "A failed run is resumed by the same command; nothing is written twice.",
      `Teardown removes exactly this run's rows: npm run unseed:${script} -- ${flags} (preview), then add --execute --confirm-teardown ${ds.runId}.`,
      "Teardown clears any genuine reference to a sample row first, and stops if a genuine row could only be kept by deleting it.",
      "Rolling back migration 0023 is possible only after teardown (supabase/rollback/0023_sample_activity.down.sql refuses while sample rows remain).",
    ],
    commands: {
      dryRun: `npm run seed:${script} -- ${flags}`,
      canary: `npm run seed:${script} -- ${flags} --execute --canary 40`,
      full: `npm run seed:${script} -- ${flags} --execute`,
      resume: `npm run seed:${script} -- ${flags} --execute`,
      validate: `npm run seed:${script} -- ${flags} --validate`,
      teardownPreview: `npm run unseed:${script} -- ${flags}`,
      teardown: `npm run unseed:${script} -- ${flags} --execute --confirm-teardown ${ds.runId}`,
    },
  };
  return { plan, dataset: ds };
}

export function writePlan(path: string, plan: Plan) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(plan, null, 2) + "\n");
}

export function readPlan(path: string): Plan {
  const plan = JSON.parse(readFileSync(path, "utf8")) as Plan;
  if (plan.planVersion !== PLAN_VERSION) throw new Error(`plan version ${plan.planVersion} is not ${PLAN_VERSION}`);
  return plan;
}

/** Regenerates the plan's dataset and proves it is the one the plan describes. */
export function datasetForPlan(plan: Plan, topics: GenConfig["topics"], banks: Banks = loadBanks()): Dataset {
  if (plan.generatorVersion !== GENERATOR_VERSION)
    throw new Error(`the plan was made by ${plan.generatorVersion}; this code is ${GENERATOR_VERSION}`);
  for (const t of plan.topics) {
    const mine = topics.find((x) => x.slug === t.slug);
    if (!mine || mine.motion !== t.motion) throw new Error(`content/topics ${t.slug} differs from the plan`);
  }
  const gen: GenConfig = { seed: plan.seed, from: plan.window.from, baseTo: plan.window.baseTo, to: plan.window.to, ...plan.config, topics };
  if (baseHash(gen) !== plan.baseHash) throw new Error("the plan's fixed part does not hash to its base hash");
  const ds = generate(gen, banks);
  if (ds.runId !== plan.runId) throw new Error("the regenerated run id differs from the plan's");
  const hash = manifestHash(ds);
  if (hash !== plan.manifestHash) throw new Error(`the regenerated dataset hashes to ${hash}, not the plan's ${plan.manifestHash}`);
  return ds;
}
