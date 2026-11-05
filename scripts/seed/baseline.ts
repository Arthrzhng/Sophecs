// What genuine data looked like before a run, read without writing, and a
// comparison afterwards. It never restores anything.
//
// On a live site readers sign up, argue, delete accounts and finish
// challenges while a run writes, so most differences between two
// snapshots are theirs. Only checks that hold whatever readers do can
// fail; the rest are reported as information:
// - each topic's stored par must equal the par /api/judge computes from
//   genuine originals alone (the last 50 ratings before), and a topic with
//   no genuine originals must keep the par it had before the run;
// - elo_percentile(1200) must equal the share computed from genuine
//   profiles alone.
// Row counts are information. That the run writes no genuine row is proven
// where it writes: every row is read back and must be marked or owned by
// the run (engine.ts), and every update is scoped to the marker (the
// adapters).
//
// No reader's row leaves the database for any of this: the snapshot reads
// counts, the topics, and each topic's par window, the ratings alone that
// /api/judge reads for it (Arthur, 2026-11-04: genuine rows do not go to a
// runner or a laptop).

import type { Adapter } from "./adapter";

export const PAR_ELO_WINDOW = 50;

export interface Baseline {
  at: string;
  genuine: Record<string, number>;
  totals: Record<string, number>;
  topics: { slug: string; motion: string; active: boolean; par_elo: number; par_n: number }[];
  /** The par /api/judge would store, from genuine originals; null with none. */
  expectedPar: Record<string, { par: number; n: number } | null>;
  percentile1200: number | null;
  expectedPercentile1200: number;
}

const MARKED_TABLES = ["profiles", "quiz_results", "challenges", "debates", "exchanges"] as const;
const OTHER_TABLES = ["turns", "reading_responses", "classes", "class_members", "blocks", "reports", "ai_calls"] as const;

export async function snapshot(adapter: Adapter): Promise<Baseline> {
  // Stamped before the first read, so activity during the reads counts as after.
  const at = new Date().toISOString();
  const genuine: Record<string, number> = {};
  for (const t of MARKED_TABLES) genuine[t] = await adapter.count(t, { sample: false });
  const totals: Record<string, number> = {};
  for (const t of OTHER_TABLES) totals[t] = await adapter.count(t);
  // The percentile straight after the counts it is compared with, and the
  // topics before their par windows: /api/judge writes a debate's rating
  // before it moves the topic's par, so a par read first always has its
  // rating in the window read after. A judging that lands between the two
  // reads still differs for a moment, which is what settledChecks reads
  // again for.
  const genuineProfiles = await adapter.count("profiles", { sample: false });
  const genuineBelow1200 = await adapter.count("profiles", { sample: false, eloBelow: 1200 });
  const percentile1200 = await adapter.percentile(1200);
  const topicRows = await adapter.scan("debate_topics", ["slug", "motion", "active", "par_elo", "par_n"]);
  const topics = topicRows.map((t) => ({
    slug: String(t.slug),
    motion: String(t.motion),
    active: Boolean(t.active),
    par_elo: Number(t.par_elo),
    par_n: Number(t.par_n),
  }));
  topics.sort((a, b) => a.slug.localeCompare(b.slug));
  const expectedPar: Baseline["expectedPar"] = {};
  for (const t of topics) {
    const window = await adapter.parWindow(t.slug, PAR_ELO_WINDOW);
    expectedPar[t.slug] = window.length ? { par: window.reduce((s, v) => s + v, 0) / window.length, n: window.length } : null;
  }
  return {
    at,
    genuine,
    totals,
    topics,
    expectedPar,
    percentile1200,
    expectedPercentile1200: genuineProfiles ? genuineBelow1200 / genuineProfiles : 0,
  };
}

export interface BaselineCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** The checks that need no baseline: par and percentile from genuine rows alone. */
export function isolationChecks(now: Baseline, before: Baseline | null = null): BaselineCheck[] {
  const checks: BaselineCheck[] = [];
  for (const t of now.topics) {
    const expected = now.expectedPar[t.slug];
    const prior = before?.topics.find((x) => x.slug === t.slug);
    if (!expected && !prior) {
      checks.push({ name: `debate_topics ${t.slug} par`, ok: true, detail: `no genuine originals; ${t.par_elo}/${t.par_n} (information)` });
      continue;
    }
    const ok = expected
      ? Math.abs(t.par_elo - expected.par) < 1e-6 && t.par_n === expected.n
      : prior!.par_elo === t.par_elo && prior!.par_n === t.par_n;
    checks.push({
      name: `debate_topics ${t.slug} par is the genuine par`,
      ok,
      detail: expected
        ? `stored ${t.par_elo}/${t.par_n}, from genuine originals ${expected.par}/${expected.n}`
        : `no genuine originals; ${prior!.par_elo}/${prior!.par_n} before, ${t.par_elo}/${t.par_n} after`,
    });
  }
  checks.push({
    name: "elo_percentile(1200) counts genuine profiles only",
    ok: now.percentile1200 !== null && Math.abs(now.percentile1200 - now.expectedPercentile1200) < 1e-9,
    detail: `function ${now.percentile1200}, from genuine profiles ${now.expectedPercentile1200}`,
  });
  return checks;
}

export const REREAD_MS = 5_000;

/**
 * A snapshot and its checks, read once more before a failure is reported.
 * /api/judge writes a debate's rating before it moves the topic's par, and
 * a reader can sign up between the profiles read and the percentile, so
 * one read can land inside a reader's write. A check that still fails on a
 * second read, taken `waitMs` later, is reported as a failure.
 */
export async function settledChecks(
  adapter: Adapter,
  check: (now: Baseline) => BaselineCheck[],
  opts: { waitMs?: number } = {}
): Promise<{ now: Baseline; checks: BaselineCheck[] }> {
  const first = await snapshot(adapter);
  const checks = check(first);
  if (checks.every((c) => c.ok)) return { now: first, checks };
  const waitMs = opts.waitMs ?? REREAD_MS;
  await new Promise((r) => setTimeout(r, waitMs));
  const now = await snapshot(adapter);
  const failedFirst = new Set(checks.filter((c) => !c.ok).map((c) => c.name));
  return {
    now,
    checks: check(now).map((c) =>
      c.ok
        ? failedFirst.has(c.name) ? { ...c, detail: `${c.detail} (differed on the first read, ${waitMs / 1000} s earlier)` } : c
        : { ...c, detail: `${c.detail}; read twice, ${waitMs / 1000} s apart` }
    ),
  };
}

export function compareBaselines(before: Baseline, after: Baseline): BaselineCheck[] {
  const checks: BaselineCheck[] = [];
  const counts = Object.keys(before.genuine).map((t) => `${t} ${before.genuine[t]} -> ${after.genuine[t]}`);
  checks.push({ name: "genuine rows", ok: true, detail: `${counts.join(", ")} (information: readers may add or delete)` });
  checks.push(...isolationChecks(after, before));
  return checks;
}
