// What genuine data looked like before a run, read without writing, and a
// comparison afterwards. The comparison never restores anything: if
// genuine readers were active during the run, their changes are reported,
// not undone.

import { createHash } from "node:crypto";
import type { Adapter } from "./adapter";

export interface Baseline {
  at: string;
  genuine: Record<string, number>;
  totals: Record<string, number>;
  genuineProfilesHash: string;
  genuineProfiles: number;
  topics: { slug: string; motion: string; active: boolean; par_elo: number; par_n: number }[];
  percentile1200: number | null;
}

const MARKED_TABLES = ["profiles", "quiz_results", "challenges", "debates", "exchanges"] as const;
const OTHER_TABLES = ["turns", "reading_responses", "classes", "class_members", "blocks", "reports", "ai_calls"] as const;

export async function snapshot(adapter: Adapter): Promise<Baseline> {
  const genuine: Record<string, number> = {};
  for (const t of MARKED_TABLES) genuine[t] = await adapter.count(t, { sample: false });
  const totals: Record<string, number> = {};
  for (const t of OTHER_TABLES) totals[t] = await adapter.count(t);
  const profiles = await adapter.scan("profiles", ["id", "elo", "streak", "school"], { sample: false });
  const canonical = profiles
    .map((p) => `${p.id}|${Number(p.elo)}|${p.streak}|${p.school}`)
    .sort()
    .join("\n");
  const topics = (await adapter.scan("debate_topics", ["slug", "motion", "active", "par_elo", "par_n"])).map((t) => ({
    slug: String(t.slug),
    motion: String(t.motion),
    active: Boolean(t.active),
    par_elo: Number(t.par_elo),
    par_n: Number(t.par_n),
  }));
  topics.sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    at: new Date().toISOString(),
    genuine,
    totals,
    genuineProfilesHash: createHash("sha256").update(canonical).digest("hex"),
    genuineProfiles: profiles.length,
    topics,
    percentile1200: await adapter.percentile(1200),
  };
}

export interface BaselineCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Genuine state must be what it was, except where genuine readers moved it
 * themselves. A change with no genuine activity to explain it fails.
 */
export function compareBaselines(before: Baseline, after: Baseline): BaselineCheck[] {
  const checks: BaselineCheck[] = [];
  const genuineActivity =
    after.genuine.debates !== before.genuine.debates || after.genuine.quiz_results !== before.genuine.quiz_results;
  for (const t of Object.keys(before.genuine)) {
    const delta = after.genuine[t] - before.genuine[t];
    checks.push({
      name: `genuine ${t} not removed`,
      ok: delta >= 0,
      detail: `${before.genuine[t]} before, ${after.genuine[t]} after`,
    });
  }
  checks.push({
    name: "genuine profiles' ratings, streaks and schools unchanged",
    ok: after.genuineProfilesHash === before.genuineProfilesHash || genuineActivity,
    detail:
      after.genuineProfilesHash === before.genuineProfilesHash
        ? `${after.genuineProfiles} genuine profiles, unchanged`
        : genuineActivity
          ? "changed, with new genuine debates or results to explain it"
          : "changed with no genuine activity to explain it",
  });
  for (const t of before.topics) {
    const a = after.topics.find((x) => x.slug === t.slug);
    const same = a && a.par_elo === t.par_elo && a.par_n === t.par_n;
    checks.push({
      name: `debate_topics ${t.slug} par unchanged`,
      ok: Boolean(same) || genuineActivity,
      detail: a ? `par ${t.par_elo}/${t.par_n} before, ${a.par_elo}/${a.par_n} after` : "topic missing after",
    });
  }
  checks.push({
    name: "elo_percentile(1200) unchanged",
    ok: after.percentile1200 === before.percentile1200 || genuineActivity,
    detail: `${before.percentile1200} before, ${after.percentile1200} after`,
  });
  return checks;
}
