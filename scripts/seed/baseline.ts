// What genuine data looked like before a run, read without writing, and a
// comparison afterwards that still means something on a live site where
// readers keep arguing while the run writes. It never restores anything.
//
// - Each genuine profile is compared row by row. A changed profile passes
//   only if that reader has genuine activity (an argument or a quiz result)
//   dated after the baseline: their own activity explains the change, a
//   seed run cannot.
// - Each topic's par is recomputed from genuine originals the way
//   /api/judge computes it (the last 50 ratings before), and must equal the
//   stored par; a topic with no genuine originals must be unchanged.
// - elo_percentile(1200) is recomputed from genuine profiles and must
//   equal what the function returns.

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
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
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
    at: new Date().toISOString(),
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

export function compareBaselines(before: Baseline, after: Baseline): BaselineCheck[] {
  const checks: BaselineCheck[] = [];
  for (const t of Object.keys(before.genuine)) {
    checks.push({
      name: `genuine ${t} not removed`,
      ok: after.genuine[t] >= before.genuine[t],
      detail: `${before.genuine[t]} before, ${after.genuine[t]} after`,
    });
  }
  const since = Date.parse(before.at);
  const activeSince = new Set(after.activity.filter((a) => Date.parse(a.at) >= since).map((a) => a.userId));
  const ids = new Set([...Object.keys(before.genuineProfiles), ...Object.keys(after.genuineProfiles)]);
  const changed = [...ids].filter((id) => before.genuineProfiles[id] !== after.genuineProfiles[id]);
  const unexplained = changed.filter((id) => !activeSince.has(id) || !(id in after.genuineProfiles));
  checks.push({
    name: "every changed genuine profile is explained by that reader's own activity",
    ok: unexplained.length === 0,
    detail: `${Object.keys(after.genuineProfiles).length} genuine profiles; ${changed.length} changed, ${unexplained.length} unexplained${unexplained.length ? ` (e.g. ${unexplained[0]})` : ""}`,
  });
  for (const t of after.topics) {
    const expected = after.expectedPar[t.slug];
    const prior = before.topics.find((x) => x.slug === t.slug);
    const ok = expected
      ? Math.abs(t.par_elo - expected.par) < 1e-6 && t.par_n === expected.n
      : Boolean(prior && prior.par_elo === t.par_elo && prior.par_n === t.par_n);
    checks.push({
      name: `debate_topics ${t.slug} par is the genuine par`,
      ok,
      detail: expected
        ? `stored ${t.par_elo}/${t.par_n}, from genuine originals ${expected.par}/${expected.n}`
        : `no genuine originals; ${prior ? `${prior.par_elo}/${prior.par_n}` : "missing"} before, ${t.par_elo}/${t.par_n} after`,
    });
  }
  checks.push({
    name: "elo_percentile(1200) counts genuine profiles only",
    ok: after.percentile1200 !== null && Math.abs(after.percentile1200 - after.expectedPercentile1200) < 1e-9,
    detail: `function ${after.percentile1200}, from genuine profiles ${after.expectedPercentile1200}`,
  });
  return checks;
}
