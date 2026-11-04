// What scripts/seed-ci.ts does, with the database, the seed and the clock
// passed in, so tests/seed/ci.test.ts can run it against the in-memory
// adapter. See seed-ci.ts for the modes and why the log says so little.

import type { Adapter } from "./adapter";
import { buildPlan } from "./plan";
import { DEFAULTS, type GenConfig } from "./generate";
import { contentTopics } from "./topics";
import { execute } from "./engine";
import { validate } from "./validate";
import { dryRun } from "./dryrun";
import { GuardError } from "./env";

export const CANARY_ACCOUNTS = 40;
export const MODES = ["canary", "full", "extend"] as const;
export type Mode = (typeof MODES)[number];

export interface CiOptions {
  mode: Mode;
  adapter: Adapter;
  seed: string;
  projectRef: string;
  /** ISO, floored to the minute. */
  now: () => string;
  log: (line: string) => void;
  /** Volumes; the defaults are production's. Tests pass smaller ones. */
  config?: Partial<Pick<GenConfig, "users" | "anonResults" | "challenges" | "exchanges" | "classes">>;
  batchSize?: number;
}

export interface CiOutcome {
  ok: boolean;
  /** What happened, in a word: nothing to do, refused by the dry run, written. */
  outcome: "idle" | "dry-run-failed" | "written";
  runId?: string;
}

export async function runCi(o: CiOptions): Promise<CiOutcome> {
  const { adapter, log } = o;
  if (!MODES.includes(o.mode)) throw new GuardError(`--mode must be one of ${MODES.join(", ")}`);
  await adapter.checkSchema();

  const active = (await adapter.listRuns()).filter((r) => r.status !== "torn_down");
  let baseTo: string;
  let cohortLimit: number | undefined;
  if (o.mode === "canary") {
    if (active.length) throw new GuardError(`run ${active[0].id} exists; a canary starts a new run`);
    baseTo = o.now();
    cohortLimit = CANARY_ACCOUNTS;
  } else {
    if (active.length === 0) {
      log("no sample run is active; nothing to do");
      return { ok: true, outcome: "idle" };
    }
    if (active.length > 1) throw new GuardError(`${active.length} sample runs are active; expected one`);
    const run = active[0];
    if (o.mode === "extend" && run.counts?.stage !== "full") {
      log(`run ${run.id} has not had its full stage; nothing to do until it has`);
      return { ok: true, outcome: "idle", runId: run.id };
    }
    baseTo = new Date(run.base_to).toISOString();
  }

  const gen: GenConfig = {
    seed: o.seed,
    from: DEFAULTS.from,
    baseTo,
    to: o.now(),
    users: DEFAULTS.users,
    anonResults: DEFAULTS.anonResults,
    challenges: DEFAULTS.challenges,
    exchanges: DEFAULTS.exchanges,
    classes: DEFAULTS.classes,
    ...o.config,
    topics: contentTopics(),
  };
  const started = Date.now();
  const { plan, dataset } = buildPlan({ target: { kind: "production", projectRef: o.projectRef }, gen, planPath: "(in memory)" });
  log(`${o.mode}: run ${plan.runId}, activity to ${plan.window.to}; plan made in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const report: Record<string, unknown> = { mode: o.mode, at: new Date().toISOString(), window: plan.window, counts: plan.counts };
  const record = async (patch: Record<string, unknown>) => {
    Object.assign(report, patch);
    if (await adapter.getRun(plan.runId)) await adapter.updateRun(plan.runId, { last_report: report });
  };

  const dry = await dryRun(adapter, plan);
  if (!dry.ok) {
    await record({ dryRun: dry.lines, ok: false });
    log("dry-run checks failed; nothing written (details in seed_runs.last_report)");
    return { ok: false, outcome: "dry-run-failed", runId: plan.runId };
  }
  log("dry-run checks passed");

  const result = await execute({ dataset, plan, adapter, cohortLimit, log, batchSize: o.batchSize ?? 250, authConcurrency: 4 });
  log(
    `wrote ${JSON.stringify(result.written)} in ${result.seconds.toFixed(1)} s (${result.rowsPerSecond.toFixed(0)} rows/s${
      result.authUsersPerSecond ? `, ${result.authUsersPerSecond.toFixed(1)} auth users/s` : ""
    })`
  );
  const v = await validate(adapter, dataset, result.before, { cohortLimit });
  for (const c of v.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}`);
  await record({ written: result.written, seconds: result.seconds, ok: v.ok, checks: v.checks });
  if (!v.ok) log("validation failed: stop here (docs/sample-activity.md, \"Stop conditions\"); details in seed_runs.last_report");
  return { ok: v.ok, outcome: "written", runId: plan.runId };
}
