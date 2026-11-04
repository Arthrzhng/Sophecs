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
// Row counts and changed genuine profiles are information. That the run
// writes no genuine row is proven where it writes: every row is read back
// and must be marked or owned by the run (engine.ts), and every update is
// scoped to the marker (the adapters).

import type { Adapter } from "./adapter";

export const PAR_ELO_WINDOW = 50;

export interface Baseline {
  at: string;
  genuine: Record<string, number>;
  totals: Record<string, number>;
  /** id -> "elo|streak|school" for every genuine profile. */
  genuineProfiles: Record<string, string>;
  topics: { slug: string; motion: string; active: boolean; par_elo: number; par_n: number }[];
  /** The par /api/judge would store, from genuine originals; null with none. */
  expectedPar: Record<string, { par: number; n: number } | null>;
  percentile1200: number | null;
  expectedPercentile1200: number;
  /** Genuine readers' arguments and quiz results: who, and when. */
  activity: { userId: string; at: string }[];
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
  const profiles = await adapter.scan("profiles", ["id", "elo", "streak", "school"], { sample: false });
  const genuineProfiles = Object.fromEntries(profiles.map((p) => [String(p.id), `${Number(p.elo)}|${p.streak}|${p.school}`]));
  const topics = (await adapter.scan("debate_topics", ["slug", "motion", "active", "par_elo", "par_n"])).map((t) => ({
    slug: String(t.slug),
    motion: String(t.motion),
    active: Boolean(t.active),
    par_elo: Number(t.par_elo),
    par_n: Number(t.par_n),
  }));
  topics.sort((a, b) => a.slug.localeCompare(b.slug));
  const debates = await adapter.scan("debates", ["user_id", "topic_slug", "kind", "elo_before", "created_at"], { sample: false });
  const expectedPar: Baseline["expectedPar"] = {};
  for (const t of topics) {
    const window = debates
      .filter((d) => d.topic_slug === t.slug && d.kind === "original" && d.elo_before !== null)
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, PAR_ELO_WINDOW)
      .map((d) => Number(d.elo_before));
    expectedPar[t.slug] = window.length ? { par: window.reduce((s, v) => s + v, 0) / window.length, n: window.length } : null;
  }
  const results = await adapter.scan("quiz_results", ["user_id", "created_at"], { sample: false });
  const activity = [...debates, ...results]
    .filter((r) => r.user_id)
    .map((r) => ({ userId: String(r.user_id), at: String(r.created_at) }));
  const elos = profiles.map((p) => Number(p.elo));
  return {
    at,
    genuine,
    totals,
    genuineProfiles,
    topics,
    expectedPar,
    percentile1200: await adapter.percentile(1200),
    expectedPercentile1200: elos.length ? elos.filter((e) => e < 1200).length / elos.length : 0,
    activity,
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
        ? `stored ${t.par_elo}/${t.par_n}, from genuine originals ${expected.par}/${expected.n}${ok ? "" : "; if two judgings finished together this can be transient: validate again before stopping"}`
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

export function compareBaselines(before: Baseline, after: Baseline): BaselineCheck[] {
  const checks: BaselineCheck[] = [];
  const counts = Object.keys(before.genuine).map((t) => `${t} ${before.genuine[t]} -> ${after.genuine[t]}`);
  checks.push({ name: "genuine rows", ok: true, detail: `${counts.join(", ")} (information: readers may add or delete)` });
  const since = Date.parse(before.at);
  const activeSince = new Set(after.activity.filter((a) => Date.parse(a.at) >= since).map((a) => a.userId));
  const existing = Object.keys(before.genuineProfiles);
  const changed = existing.filter((id) => id in after.genuineProfiles && before.genuineProfiles[id] !== after.genuineProfiles[id]);
  const added = Object.keys(after.genuineProfiles).filter((id) => !(id in before.genuineProfiles)).length;
  const removed = existing.filter((id) => !(id in after.genuineProfiles)).length;
  const quiet = changed.filter((id) => !activeSince.has(id)).length;
  checks.push({
    name: "genuine profiles",
    ok: true,
    detail: `${changed.length} changed (${quiet} with no new argument or result of their own, e.g. a challenge's other side or a late verdict), ${added} new, ${removed} removed (information)`,
  });
  checks.push(...isolationChecks(after, before));
  return checks;
}
