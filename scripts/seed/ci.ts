// What scripts/seed-ci.ts does, with the database, the seed and the clock
// passed in, so tests/seed/ci.test.ts can run it against the in-memory
// adapter. See seed-ci.ts for the modes and why the log says so little.

import type { Adapter } from "./adapter";
import { buildPlan, describe } from "./plan";
import { DEFAULTS, RUN_QUIZ, RUN_WEEKLY, type GenConfig } from "./generate";
import { contentTopics } from "./topics";
import { execute, finishValidation, HaltedError, isHalted, LockLostError, recordedOnRun, releaseHeld, StopError, thrownWhileWriting, VALIDATING } from "./engine";
import { validate } from "./validate";
import { dryRun } from "./dryrun";
import { roundScoreCheck, spotDebates, storedScoreCheck } from "./round-scores";
import { GuardError } from "./env";
import { preview, teardown } from "./teardown";

export const CANARY_ACCOUNTS = 40;
/** Arthur, 2026-11-04: exact duplicate argument texts under 5%. */
export const MAX_EXACT_DUPLICATE_PCT = 5;
/**
 * A halted run (engine.ts, HALT_PREFIX): a failed validation, a validation
 * that did not finish, or a refusal while writing. The schedule (extend)
 * then writes nothing until a full stage, run by hand, passes validation
 * again. A run that failed for any other reason (a lost runner, a timeout,
 * a database error) is resumed by the next scheduled run.
 */
export { HALTED, VALIDATING, REFUSED } from "./engine";
export const MODES = ["canary", "full", "extend", "teardown"] as const;
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
  config?: Partial<Pick<GenConfig, "users" | "anonResults" | "challenges" | "exchanges" | "classes" | "quiz">>;
  batchSize?: number;
  /** Teardown only: must repeat the active run's id exactly. */
  confirmTeardown?: string;
  /** Tests only: the duplicate limit, MAX_EXACT_DUPLICATE_PCT otherwise. */
  maxExactDuplicatePct?: number;
  /** Tests only: the round-score limit and minimum, MAX_ROUND_SCORE_PCT and MIN_ROUND_SCORE_SAMPLE otherwise. */
  maxRoundScorePct?: number;
  minRoundScoreSample?: number;
}

export interface CiOutcome {
  ok: boolean;
  /** What happened, in a word: nothing to do, refused by the dry run, written. */
  outcome: "idle" | "halted" | "dry-run-failed" | "written" | "torn-down" | "teardown-stopped";
  runId?: string;
}

/** How often an extension reads the whole run back rather than only its new rows (item 28). */
export const READ_WHOLE_EVERY_MS = 24 * 3_600_000;

export async function runCi(o: CiOptions): Promise<CiOutcome> {
  const { adapter, log } = o;
  if (!MODES.includes(o.mode)) throw new GuardError(`--mode must be one of ${MODES.join(", ")}`);
  await adapter.checkSchema();

  const active = (await adapter.listRuns()).filter((r) => r.status !== "torn_down");
  if (o.mode === "teardown") return tearDown(o, active);
  let baseTo: string;
  let cohortLimit: number | undefined;
  // An extension of a complete run reads only what is new since its end
  // (Arthur, 2026-11-09, item 28: "keep hourly and cut what each run
  // reads"), except once a day: the first extension more than
  // READ_WHOLE_EVERY_MS after the run was last read whole reads it whole
  // again, so a change to an older row is found within a day. A canary, a
  // full stage, or a run that is not complete reads everything, as before.
  let since: string | undefined;
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
    // The halt first, so a halted run fails the schedule at every stage.
    if (o.mode === "extend" && isHalted(run)) {
      log(`run ${run.id} is halted (${run.last_error?.split(":").slice(0, 2).join(":")}); nothing written until a full stage, run by hand, passes`);
      return { ok: false, outcome: "halted", runId: run.id };
    }
    if (o.mode === "extend" && run.counts?.stage !== "full") {
      log(`run ${run.id} has not had its full stage; nothing to do until it has`);
      return { ok: true, outcome: "idle", runId: run.id };
    }
    baseTo = new Date(run.base_to).toISOString();
    const wholeAt = Date.parse(String(run.counts?.read_whole_at ?? ""));
    if (o.mode === "extend" && run.status === "complete" && Number.isFinite(wholeAt) && Date.parse(o.now()) - wholeAt < READ_WHOLE_EVERY_MS)
      since = new Date(run.window_to).toISOString();
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
    ...(RUN_QUIZ ? { quiz: RUN_QUIZ } : {}),
    ...(RUN_WEEKLY ? { weekly: RUN_WEEKLY } : {}),
    ...o.config,
    topics: contentTopics(),
  };
  // The weekly shape is a quiz v2 run's; a run that names no quiz is drawn
  // as every run before it was.
  if (gen.quiz !== 2) delete gen.weekly;
  const started = Date.now();
  const { plan, dataset } = buildPlan({ target: { kind: "production", projectRef: o.projectRef }, gen, planPath: "(in memory)" });
  log(`${o.mode}: run ${plan.runId}, activity to ${plan.window.to}; plan made in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const report: Record<string, unknown> = { mode: o.mode, at: new Date().toISOString(), window: plan.window, counts: plan.counts };
  const record = async (patch: Record<string, unknown>) => {
    Object.assign(report, patch);
    if (await adapter.getRun(plan.runId)) await adapter.updateRun(plan.runId, { last_report: report });
  };

  // The duplicate rate is the plan's own, so it is checked before anything
  // is written: an extension that would cross the limit is refused, not
  // written and halted afterwards.
  const maxDup = o.maxExactDuplicatePct ?? MAX_EXACT_DUPLICATE_PCT;
  const dupPct = Number((describe(dataset) as { exactDuplicateArgumentsPct: number }).exactDuplicateArgumentsPct);
  const dupCheck = { name: `exact duplicate argument texts under ${maxDup}%`, ok: dupPct < maxDup, detail: `${dupPct}%` };
  // So is how often its scores land on a multiple of 5, and the stored
  // scores must already be the plan's; validate repeats both after the
  // writes.
  const roundCheck = roundScoreCheck(dataset, { cohortLimit, max: o.maxRoundScorePct, min: o.minRoundScoreSample });
  const storedCheck = await storedScoreCheck(adapter, dataset, { cohortLimit, ...(since ? { ids: spotDebates(dataset, since, plan.window.to) } : {}) });
  const dry = await dryRun(adapter, plan);
  const planChecks = [dupCheck, roundCheck, storedCheck];
  const dryLines = [...dry.lines, ...planChecks.map((c) => `${c.ok ? "ok" : "FAIL"}: ${c.name}: ${c.detail}`)];
  const failedPlanChecks = planChecks.filter((c) => !c.ok);
  if (!dry.ok || failedPlanChecks.length) {
    await record({ dryRun: dryLines, ok: false });
    log(
      `dry-run checks failed${failedPlanChecks.length ? ` (${failedPlanChecks.map((c) => `${c.name}: ${c.detail}`).join("; ")})` : ""}; nothing written (details in seed_runs.last_report)`
    );
    return { ok: false, outcome: "dry-run-failed", runId: plan.runId };
  }
  log("dry-run checks passed");

  // A job the runner killed (the timeout, a cancel, a lost machine) leaves
  // its lock behind. The workflow's concurrency group runs one job at a
  // time, so a lock untouched for STALE_LOCK_MINUTES is a dead job's.
  // The run ends halted (VALIDATING) and stays so until the validation
  // below passes: a validation that throws, or a job lost before it
  // finishes, leaves the schedule writing nothing.
  let result: Awaited<ReturnType<typeof execute>>;
  try {
    result = await execute({
      dataset,
      plan,
      adapter,
      cohortLimit,
      log,
      batchSize: o.batchSize ?? 250,
      authConcurrency: 4,
      breakStaleLock: true,
      endHalted: VALIDATING,
      // The schedule checked for a halt before its plan, minutes ago.
      refuseHalted: o.mode === "extend",
      since,
    });
  } catch (err) {
    if (err instanceof HaltedError) {
      log(`run ${plan.runId} was halted before this run took its lock; nothing written`);
      return { ok: false, outcome: "halted", runId: plan.runId };
    }
    // An error from the writes can name row ids, and this log is public:
    // execute writes it to seed_runs.last_error, which only the server role
    // reads, so the log gets a line of its own, whether or not that write
    // succeeded.
    if (!thrownWhileWriting(err)) throw err;
    const what = err instanceof LockLostError ? "lost its lock" : err instanceof StopError ? "stopped on a refusal" : "failed while writing";
    const line = `the run ${what}; ${
      recordedOnRun(err) ? "seed_runs.last_error has the detail" : "the detail could not be recorded on the run"
    }`;
    log(line);
    throw err instanceof StopError ? new StopError(line) : new Error(line);
  }
  log(
    `wrote ${JSON.stringify(result.written)} in ${result.seconds.toFixed(1)} s (${result.rowsPerSecond.toFixed(0)} rows/s${
      result.authUsersPerSecond ? `, ${result.authUsersPerSecond.toFixed(1)} auth users/s` : ""
    })`
  );
  // The lock execute kept is released by finishValidation, or here if the
  // validation throws; the run then stays halted, "validation not finished".
  let ok: boolean;
  let recorded: boolean;
  try {
    const v = await validate(adapter, dataset, result.before, { cohortLimit, since: result.lightSince });
    const checks = [...v.checks, dupCheck];
    ok = checks.every((c) => c.ok);
    for (const c of checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}`);
    await record({ written: result.written, seconds: result.seconds, ok, checks });
    recorded = await finishValidation(adapter, result, checks.filter((c) => !c.ok).map((c) => c.name));
  } finally {
    await releaseHeld(adapter, result);
  }
  if (!recorded) {
    log("the validation's result could not be recorded (the run's lock was lost); the run stays halted until a full stage, run by hand, passes");
    return { ok: false, outcome: "written", runId: plan.runId };
  }
  if (!ok)
    log("validation failed: the run is halted, and the schedule writes nothing until a full stage passes (docs/sample-activity.md, \"Stop conditions\"); details in seed_runs.last_report");
  return { ok, outcome: "written", runId: plan.runId };
}

// Teardown, on Arthur's instruction only: by hand, with the run's id typed
// in to confirm. The log gets counts; row ids, genuine ones included, go to
// seed_runs.last_report.
async function tearDown(o: CiOptions, active: Awaited<ReturnType<CiOptions["adapter"]["listRuns"]>>): Promise<CiOutcome> {
  const { adapter, log } = o;
  if (active.length === 0) {
    log("no sample run is active; nothing to tear down");
    return { ok: true, outcome: "idle" };
  }
  if (active.length > 1) throw new GuardError(`${active.length} sample runs are active; expected one`);
  const run = active[0];
  if (o.confirmTeardown !== run.id) throw new GuardError(`teardown needs confirm_teardown to repeat the run id exactly (${run.id})`);
  const p = await preview(adapter, run.id);
  for (const [kind, v] of Object.entries(p.items)) log(`  ${kind}: ${v.created} created, ${v.intended} intended, ${v.deleted} already deleted`);
  log(`genuine references to sample rows: ${p.entanglements.length} (${p.blocking.length} that teardown cannot keep)`);
  const report: Record<string, unknown> = { mode: "teardown", at: new Date().toISOString(), preview: p };
  try {
    const r = await teardown(adapter, run.id, { log: (line) => log(line), breakStaleLock: true });
    for (const c of r.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}`);
    const ok = r.checks.every((c) => c.ok);
    await adapter.updateRun(run.id, { last_report: { ...report, deleted: r.deleted, checks: r.checks, ok } });
    return { ok, outcome: "torn-down", runId: run.id };
  } catch (err) {
    await adapter.updateRun(run.id, { last_report: { ...report, error: String((err as Error).message), ok: false } });
    log("teardown stopped; nothing more was deleted (the reason is in seed_runs.last_report)");
    return { ok: false, outcome: "teardown-stopped", runId: run.id };
  }
}
