// The dry run against a target: reads only. It checks the schema, records
// the baseline genuine state, lists runs and locks, and compares the
// target's motions with the plan's. tests/seed/dryrun.test.ts runs it
// against an adapter that throws on every write.

import type { Adapter } from "./adapter";
import type { Plan } from "./plan";
import { settledChecks, isolationChecks, type Baseline } from "./baseline";

export interface DryRunReport {
  ok: boolean;
  lines: string[];
  baseline: Baseline;
}

export async function dryRun(adapter: Adapter, plan: Plan, opts: { rereadMs?: number } = {}): Promise<DryRunReport> {
  const lines: string[] = [];
  let ok = true;
  await adapter.checkSchema();
  lines.push("schema: migration 0023 is in place");
  // The checks a run is validated against must already hold before it, or
  // a failure afterwards could not be told from one the run caused. A
  // failure is read again before it is reported (baseline.ts).
  const { now: baseline, checks } = await settledChecks(adapter, (now) => isolationChecks(now), { waitMs: opts.rereadMs });
  lines.push(`genuine rows: ${JSON.stringify(baseline.genuine)}; other tables: ${JSON.stringify(baseline.totals)}`);
  lines.push(`genuine profiles: ${baseline.genuine.profiles}; elo_percentile(1200) = ${baseline.percentile1200}`);
  for (const c of checks) {
    if (!c.ok) ok = false;
    lines.push(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
  }
  const runs = await adapter.listRuns();
  lines.push(`runs on target: ${runs.map((r) => `${r.id} ${r.status}${r.lock_token ? " (locked)" : ""}`).join(", ") || "none"}`);
  const run = runs.find((r) => r.id === plan.runId);
  if (run && run.plan_hash !== plan.baseHash) {
    ok = false;
    lines.push(`this run exists with a different seed, base window or config: refuse`);
  } else if (run && Date.parse(plan.window.to) < Date.parse(run.window_to)) {
    ok = false;
    lines.push(`this run already reaches ${run.window_to}, later than this plan: refuse`);
  } else lines.push(run ? `this run exists: ${run.status}, stage ${String(run.counts?.stage ?? "none")}` : "this run has not started");
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
