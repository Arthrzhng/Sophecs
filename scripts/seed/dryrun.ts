// The dry run against a target: reads only. It checks the schema, records
// the baseline genuine state, lists runs and locks, and compares the
// target's motions with the plan's. tests/seed/dryrun.test.ts runs it
// against an adapter that throws on every write.

import type { Adapter } from "./adapter";
import type { Plan } from "./plan";
import { snapshot, isolationChecks, type Baseline } from "./baseline";

export interface DryRunReport {
  ok: boolean;
  lines: string[];
  baseline: Baseline;
}

export async function dryRun(adapter: Adapter, plan: Plan): Promise<DryRunReport> {
  const lines: string[] = [];
  let ok = true;
  await adapter.checkSchema();
  lines.push("schema: migration 0021 is in place");
  const baseline = await snapshot(adapter);
  lines.push(`genuine rows: ${JSON.stringify(baseline.genuine)}; other tables: ${JSON.stringify(baseline.totals)}`);
  lines.push(`genuine profiles: ${Object.keys(baseline.genuineProfiles).length}; elo_percentile(1200) = ${baseline.percentile1200}`);
  // The checks a run is validated against must already hold before it, or
  // a failure afterwards could not be told from one the run caused.
  for (const c of isolationChecks(baseline)) {
    if (!c.ok) ok = false;
    lines.push(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
  }
  const runs = await adapter.listRuns();
  lines.push(`runs on target: ${runs.map((r) => `${r.id} ${r.status}${r.lock_token ? " (locked)" : ""}`).join(", ") || "none"}`);
  const run = runs.find((r) => r.id === plan.runId);
  if (run && run.plan_hash !== plan.manifestHash) {
    ok = false;
    lines.push(`this run exists with a different plan hash: refuse`);
  } else lines.push(run ? `this run exists: ${run.status}` : "this run has not started");
  const locked = runs.filter((r) => r.id !== plan.runId && r.lock_token);
  if (locked.length) {
    ok = false;
    lines.push(`run ${locked[0].id} holds a lock: refuse`);
  }
  for (const t of plan.topics) {
    const live = baseline.topics.find((x) => x.slug === t.slug);
    const same = Boolean(live && live.active && live.motion === t.motion);
    if (!same) ok = false;
    lines.push(`  ${t.slug}: ${same ? "motion matches" : "DIFFERS: make a new plan"}${live ? `, par ${live.par_elo}/${live.par_n}` : ""}`);
  }
  lines.push(ok ? "dry run passed; nothing written" : "dry run found a problem; nothing written");
  return { ok, lines, baseline };
}

/**
 * Every genuine row of the tables a run touches or reads around, for the
 * operator to keep before the first write. Production is on the free plan,
 * with no restorable backup; this file, the registry and teardown are the
 * recovery path (docs/sample-activity.md, "Backup and recovery"). It holds
 * readers' data, so it is written only to scripts/seed/reports/ on the
 * operator's own machine, which is git-ignored, and never printed.
 */
export async function exportGenuine(adapter: Adapter): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  const all = ["*"];
  for (const t of ["profiles", "quiz_results", "challenges", "debates", "exchanges"] as const) out[t] = await adapter.scan(t, all, { sample: false });
  for (const t of ["turns", "reading_responses", "classes", "class_members", "blocks", "reports", "debate_topics"] as const) out[t] = await adapter.scan(t, all);
  return out;
}
