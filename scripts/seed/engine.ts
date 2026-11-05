// Executes a plan against an adapter: in foreign-key order, in batches,
// registry first, every write read back and its ownership proven before it
// is marked created. Re-running the same plan resumes it; nothing is
// written twice, whatever a previous attempt's responses said.
//
// The order of one batch:
// 1. record intents (run, kind, logical id, row id) in seed_run_items. A
//    row id another run already owns is refused by the registry's unique
//    index, so two runs can never claim one row;
// 2. write the rows with insert-or-ignore on their primary key, so a row
//    an earlier attempt wrote and failed to confirm is not written again;
// 3. read the rows back and check each is the run's: marked is_sample, or
//    owned by one of the run's users. A row that exists and is not ours (an
//    id collision with a genuine row) stops the run rather than be adopted;
// 4. mark the intents created.

import { randomUUID } from "node:crypto";
import type { Adapter, Kind, RegistryItem, SeedRun, Table } from "./adapter";
import type { Dataset, Item } from "./generate";
import type { Plan } from "./plan";
import { snapshot, compareBaselines, type Baseline } from "./baseline";

export class StopError extends Error {}
/** This process no longer holds the run's lock: it must not touch the run row again. */
export class LockLostError extends StopError {}

export interface Phase {
  kind: Kind;
  table: Table | null; // null for auth users
  items: Item<Record<string, unknown>>[];
  conflict: string[];
}

export function phases(ds: Dataset): Phase[] {
  const p = (kind: Kind, table: Table | null, items: Item<unknown>[], conflict = ["id"]): Phase => ({
    kind,
    table,
    items: items as Item<Record<string, unknown>>[],
    conflict,
  });
  return [
    p("auth_user", null, ds.authUsers),
    p("profile", "profiles", ds.profiles),
    p("quiz_result", "quiz_results", ds.quizResults),
    p("challenge", "challenges", ds.challenges),
    p("debate", "debates", ds.debates),
    p("exchange", "exchanges", ds.exchanges),
    p("turn", "turns", ds.turns),
    p("reading_response", "reading_responses", ds.readingResponses),
    p("class", "classes", ds.classes),
    p("class_member", "class_members", ds.classMembers, ["class_id", "user_id"]),
  ];
}

export interface ExecuteOptions {
  dataset: Dataset;
  plan: Plan;
  adapter: Adapter;
  /** Only rows whose cohort is below this: the canary. */
  cohortLimit?: number;
  batchSize?: number;
  authConcurrency?: number;
  log?: (line: string) => void;
  signal?: AbortSignal;
  retries?: number;
  retryBaseMs?: number;
  /** Clear this run's lock if a dead process left it more than STALE_LOCK_MINUTES ago. */
  breakStaleLock?: boolean;
  /**
   * End the run halted with this, not "complete", for a caller that
   * validates next: it stays halted until finishValidation records a pass.
   * A crash before the end leaves the run failed and resumable, as without it.
   */
  endHalted?: string;
}

/**
 * A halted run: seed_runs.status "failed", with last_error starting with
 * this. The schedule writes nothing to a halted run, and a run of it by
 * hand keeps the halt until a validation after it passes
 * (docs/sample-activity.md, "Stop conditions").
 */
export const HALT_PREFIX = "halted:";
/** A validation found something wrong. */
export const HALTED = `${HALT_PREFIX} validation failed`;
/** Rows were written and no validation has passed since. */
export const VALIDATING = `${HALT_PREFIX} validation not finished`;
/** A refusal while writing: a row it would not adopt, a user without its ban. */
export const REFUSED = `${HALT_PREFIX} stopped`;

export function isHalted(run: Pick<SeedRun, "status" | "last_error"> | null | undefined): boolean {
  return !!run && run.status === "failed" && (run.last_error ?? "").startsWith(HALT_PREFIX);
}

/**
 * After a validation: a pass lifts the halt and gives the run the status
 * execute ended it on; a failure halts it, naming the checks that failed.
 *
 * Under the run's lock, and only if the run is still as execute left it:
 * a teardown, or another process's run or halt, between the end of the
 * writes and here is not written over. Returns whether it recorded; when
 * it did not, the run keeps whatever state it has, which for the state
 * execute left is still a halt.
 */
export async function finishValidation(
  adapter: Adapter,
  run: Pick<ExecuteReport, "runId" | "endStatus" | "heldWith">,
  failed: string[]
): Promise<boolean> {
  const token = randomUUID();
  if (!(await adapter.acquireLock(run.runId, token))) return false;
  try {
    const now = await adapter.getRun(run.runId);
    const expected = run.heldWith ? { status: "failed", last_error: run.heldWith } : { status: run.endStatus, last_error: null };
    if (!now || now.status !== expected.status || (now.last_error ?? null) !== expected.last_error) return false;
    return await adapter.updateRunLocked(
      run.runId,
      token,
      failed.length === 0
        ? { status: run.endStatus, last_error: null }
        : { status: "failed", last_error: `${HALTED}: ${failed.join("; ")}`.slice(0, 500) }
    );
  } finally {
    await adapter.releaseLock(run.runId, token).catch(() => {});
  }
}

// Errors execute has already written to the run's last_error: their
// messages can name row ids, so a caller that prints to a public log
// prints a line of its own instead (scripts/seed/ci.ts).
const recorded = new WeakSet<object>();
export const recordedOnRun = (err: unknown): boolean => typeof err === "object" && err !== null && recorded.has(err);

// A live run refreshes its lock before every batch, and a batch takes
// seconds, so a lock untouched for this long belongs to a process that died.
export const STALE_LOCK_MINUTES = 15;

/** Before every batch: still ours, and fresh. Stops the run if another process took it. */
export async function heartbeat(adapter: Adapter, runId: string, token: string) {
  if (!(await adapter.refreshLock(runId, token)))
    throw new LockLostError(`run ${runId}'s lock was taken by another process; stopping without writing more`);
}

/**
 * A heartbeat at most once a minute, for loops of one request at a time
 * (auth users), where a batch can take longer than the stale-lock window.
 */
export function pulse(adapter: Adapter, runId: string, token: string, everyMs = 60_000) {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < everyMs) return;
    last = Date.now();
    await heartbeat(adapter, runId, token);
  };
}

/** Releases the lock without letting a failure to release hide the error that ended the run. */
export async function releaseQuietly(adapter: Adapter, runId: string, token: string, log: (s: string) => void) {
  try {
    await adapter.releaseLock(runId, token);
  } catch (err) {
    log(`could not release the lock on ${runId} (${(err as Error).message}); it goes stale in ${STALE_LOCK_MINUTES} minutes`);
  }
}

export interface ExecuteReport {
  runId: string;
  written: Record<string, number>;
  skipped: Record<string, number>;
  seconds: number;
  rowsPerSecond: number;
  authUsersPerSecond: number | null;
  before: Baseline;
  cancelled: boolean;
  /** The status a passing validation gives the run (finishValidation). */
  endStatus: "complete" | "running";
  /** The halt execute left the run under, if any: last_error, with status "failed". */
  heldWith: string | null;
}

async function retry<T>(fn: () => Promise<T>, attempts: number, baseMs: number, log: (s: string) => void, what: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof StopError) throw err;
      last = err;
      if (i < attempts - 1) {
        const wait = baseMs * 2 ** i;
        log(`  retry ${i + 1}/${attempts - 1} after ${wait} ms: ${what}: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw last;
}

/** Profile fields a later plan can change: what the replay ends on. */
export const PROFILE_MUTABLE = ["elo", "streak", "streak_updated_on", "school", "school_history"] as const;

/** JSON with object keys sorted: jsonb does not keep the order they were written in. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** The mutable fields where the database row differs from the plan's. */
export function changedFields(current: Record<string, unknown> | undefined, planned: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!current) return out;
  for (const k of PROFILE_MUTABLE) {
    const a = current[k] ?? null;
    const b = planned[k] ?? null;
    const same = typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : canonical(a) === canonical(b);
    if (!same) out[k] = b;
  }
  return out;
}

export function ownerIds(ds: Dataset): Set<string> {
  return new Set([...ds.authUsers.map((u) => u.rowId), ...ds.exchanges.map((e) => e.rowId)]);
}

/** Proves a read-back row is this run's. Throws StopError otherwise. */
export function assertOwned(table: Table, row: Record<string, unknown>, expected: Record<string, unknown>, owners: Set<string>) {
  const id = table === "class_members" ? `${row.class_id}:${row.user_id}` : String(row.id);
  const marked = ["profiles", "quiz_results", "challenges", "debates", "exchanges"].includes(table);
  if (marked && row.is_sample !== true)
    throw new StopError(`${table} ${id} exists and is not a sample row; refusing to adopt it`);
  const ownerCol =
    table === "debates" || table === "reading_responses" || table === "class_members" ? "user_id"
      : table === "turns" ? "exchange_id"
        : table === "classes" ? "owner_id"
          : null;
  if (ownerCol && (!owners.has(String(row[ownerCol])) || row[ownerCol] !== expected[ownerCol]))
    throw new StopError(`${table} ${id} exists and belongs to someone else; refusing to adopt it`);
}

export async function execute(opts: ExecuteOptions): Promise<ExecuteReport> {
  const { dataset: ds, plan, adapter } = opts;
  const log = opts.log ?? (() => {});
  const batchSize = opts.batchSize ?? 250;
  const attempts = opts.retries ?? 4;
  const baseMs = opts.retryBaseMs ?? 500;
  const limit = opts.cohortLimit ?? Infinity;
  const started = Date.now();
  const token = randomUUID();

  if (ds.runId !== plan.runId) throw new StopError("the dataset is not the plan's");
  await adapter.checkSchema();

  // Preflight, all reads: the motions match, nobody else is running.
  const before = await snapshot(adapter);
  for (const t of plan.topics) {
    const live = before.topics.find((x) => x.slug === t.slug);
    if (!live || !live.active || live.motion !== t.motion)
      throw new StopError(`debate_topics ${t.slug} differs from the plan; make a new plan`);
  }
  const others = (await adapter.listRuns()).filter((r) => r.id !== plan.runId && r.lock_token);
  if (others.length) throw new StopError(`run ${others[0].id} holds a lock; one run at a time`);

  let run = await adapter.getRun(plan.runId);
  if (!run) {
    const fresh: SeedRun = {
      id: plan.runId,
      status: "running",
      plan_hash: plan.baseHash,
      generator_version: plan.generatorVersion,
      window_from: plan.window.from,
      base_to: plan.window.baseTo,
      window_to: plan.window.to,
      counts: plan.counts,
      last_report: null,
      lock_token: null,
      locked_at: null,
      last_error: null,
    };
    await adapter.insertRun(fresh);
    run = fresh;
  }
  // The same run: the same generator, seed, base window, config and
  // motions (the base hash). Only `to` may differ, and only later.
  if (
    run.plan_hash !== plan.baseHash ||
    run.generator_version !== plan.generatorVersion ||
    Date.parse(run.base_to) !== Date.parse(plan.window.baseTo) ||
    Date.parse(run.window_from) !== Date.parse(plan.window.from)
  )
    throw new StopError(`run ${run.id} was started from a different plan`);
  if (Date.parse(plan.window.to) < Date.parse(run.window_to))
    throw new StopError(`run ${run.id} already reaches ${run.window_to}; this plan ends earlier, at ${plan.window.to}`);
  if (run.status === "tearing_down" || run.status === "torn_down")
    throw new StopError(`run ${run.id} is ${run.status}; it cannot be resumed`);
  // A canary validates only its first cohorts, so on a run that has had its
  // full stage it could pass while the rest is wrong, and lift a halt.
  if (Number.isFinite(limit) && String(run.counts?.stage ?? "") === "full")
    throw new StopError(`run ${run.id} has had its full stage; a canary cannot be run on it`);
  if (run.lock_token && opts.breakStaleLock) {
    if (!(await adapter.breakStaleLock(run.id, STALE_LOCK_MINUTES)))
      throw new StopError(`run ${run.id}'s lock is less than ${STALE_LOCK_MINUTES} minutes old; another process may still be running`);
    log(`cleared a stale lock on ${run.id}`);
  }
  if (!(await adapter.acquireLock(run.id, token)))
    throw new StopError(`run ${run.id} is locked by another process (if that process died, add --break-stale-lock after ${STALE_LOCK_MINUTES} minutes)`);
  const racing = (await adapter.listRuns()).filter((r) => r.id !== run!.id && r.lock_token);
  if (racing.length) {
    await adapter.releaseLock(run.id, token);
    throw new StopError(`run ${racing[0].id} took a lock at the same time; stopping`);
  }
  // A halted run stays halted while it is written to, whatever happens
  // here: only a validation that passes afterwards lifts it.
  const keep = isHalted(run) ? run.last_error! : null;
  if (!(await adapter.updateRunLocked(run.id, token, keep ? { status: "failed", last_error: keep } : { status: "running", last_error: null })))
    throw new LockLostError(`run ${run.id}'s lock was taken before the run began`);

  const owners = ownerIds(ds);
  const written: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  let rows = 0;
  let authSeconds = 0;
  let authCount = 0;
  let cancelled = false;
  let endStatus: "complete" | "running" = "running";
  let hold: string | null = null;

  try {
    for (const phase of phases(ds)) {
      const wanted = phase.items.filter((i) => i.cohort < limit);
      const known = new Map<string, RegistryItem>((await adapter.items(run.id, phase.kind)).map((i) => [i.logical_id, i]));
      const pending = wanted.filter((i) => known.get(i.logicalId)?.state !== "created");
      skipped[phase.kind] = wanted.length - pending.length;
      written[phase.kind] = 0;
      log(`${phase.kind}: ${wanted.length} in scope, ${skipped[phase.kind]} already created, ${pending.length} to write`);
      const phaseStart = Date.now();
      for (let i = 0; i < pending.length; i += batchSize) {
        if (opts.signal?.aborted) {
          cancelled = true;
          break;
        }
        const batch = pending.slice(i, i + batchSize);
        await heartbeat(adapter, run.id, token);
        await retry(
          () => adapter.recordIntents(batch.map((b) => ({ run_id: run!.id, kind: phase.kind, logical_id: b.logicalId, row_id: b.rowId }))),
          attempts, baseMs, log, `${phase.kind} intents`
        );
        if (phase.kind === "auth_user") {
          await writeAuthUsers(adapter, run.id, batch, known, opts.authConcurrency ?? 4, attempts, baseMs, log, pulse(adapter, run.id, token));
        } else {
          await retry(() => adapter.insertIgnore(phase.table!, batch.map((b) => b.row), phase.conflict), attempts, baseMs, log, `${phase.table} insert`);
          const back = await retry(() => adapter.selectByIds(phase.table!, batch.map((b) => b.rowId)), attempts, baseMs, log, `${phase.table} read back`);
          const byId = new Map(back.map((r) => [phase.table === "class_members" ? `${r.class_id}:${r.user_id}` : String(r.id), r]));
          for (const b of batch) {
            const r = byId.get(b.rowId);
            if (!r) throw new Error(`${phase.table} ${b.rowId} is missing after insert`);
            assertOwned(phase.table!, r, b.row, owners);
          }
        }
        // Still ours before anything is marked: a process that lost the lock
        // mid-batch stops here rather than record work as its own.
        await heartbeat(adapter, run.id, token);
        await retry(() => adapter.setState(run!.id, phase.kind, batch.map((b) => b.logicalId), "created"), attempts, baseMs, log, `${phase.kind} mark`);
        written[phase.kind] += batch.length;
        rows += batch.length;
        log(`  ${phase.kind}: ${Math.min(i + batchSize, pending.length)}/${pending.length}`);
      }
      if (phase.kind === "auth_user") {
        authSeconds = (Date.now() - phaseStart) / 1000;
        authCount = written[phase.kind];
      }
      if (cancelled) break;
      // Challenges are written before the debates that name them; their
      // own debate ids go on once the debates exist.
      if (phase.kind === "debate") {
        const links = ds.challengeLinks.filter((l) => l.cohort < limit);
        for (const [n, l] of links.entries()) {
          if (n % 25 === 0) await heartbeat(adapter, run.id, token);
          await retry(() => adapter.linkChallenge(l.rowId, l.row.challenger_debate_id, l.row.challengee_debate_id), attempts, baseMs, log, "challenge link");
        }
        log(`challenge links: ${links.length} set`);
      }
    }
    // Profiles written earlier (by the canary, or before an extension)
    // carry the rating, streak and school of their time; bring them to the
    // plan's. Read back and compared first, so only a changed profile is
    // written, and every update is scoped to sample rows by the adapter.
    if (!cancelled) {
      const profilesNow = ds.profiles.filter((p) => p.cohort < limit);
      let updated = 0;
      for (let i = 0; i < profilesNow.length; i += batchSize) {
        if (opts.signal?.aborted) {
          cancelled = true;
          break;
        }
        const batch = profilesNow.slice(i, i + batchSize);
        await heartbeat(adapter, run.id, token);
        const back = await retry(() => adapter.selectByIds("profiles", batch.map((b) => b.rowId)), attempts, baseMs, log, "profiles read back");
        const byId = new Map(back.map((r) => [String(r.id), r]));
        const changes = batch
          .map((b) => ({ id: b.rowId, patch: changedFields(byId.get(b.rowId), b.row as unknown as Record<string, unknown>) }))
          .filter((c) => Object.keys(c.patch).length > 0);
        for (const c of changes) {
          if (!byId.get(c.id) || byId.get(c.id)!.is_sample !== true) throw new StopError(`profiles ${c.id} is not a sample row; refusing to update it`);
        }
        if (changes.length) await retry(() => adapter.updateSampleRows("profiles", changes), attempts, baseMs, log, "profiles update");
        updated += changes.length;
      }
      written.profile_update = updated;
      log(`profiles brought up to date: ${updated}`);
    }
    const complete = !cancelled && limit === Infinity;
    endStatus = complete ? "complete" : "running";
    hold = keep ?? opts.endHalted ?? null;
    const recorded = await adapter.updateRunLocked(run.id, token, {
      status: hold ? "failed" : endStatus,
      last_error: hold ?? (cancelled ? "cancelled; run the same command again to resume" : null),
      // window_to moves only when the whole plan is in: a canary or a
      // cancelled run leaves it where it was.
      ...(complete ? { window_to: plan.window.to } : {}),
      counts: {
        ...plan.counts,
        manifest_hash: plan.manifestHash,
        stage: complete ? "full" : String(run.counts?.stage ?? "") === "full" ? "full" : "canary",
        cohortLimit: Number.isFinite(limit) ? limit : null,
      },
    });
    if (!recorded) throw new LockLostError(`run ${run.id}'s lock was taken before the run could record its end`);
  } catch (err) {
    // Only while still holding the lock: a process that lost it must not
    // write over the state of the one that took it.
    // A refusal (StopError) halts the run, so the schedule does not try
    // again every six hours; anything else, a database error past the
    // retries, leaves it failed and resumable. A halt already in place is
    // kept in front.
    if (!(err instanceof LockLostError)) {
      const message = String((err as Error).message);
      const error = keep ? `${keep.slice(0, 200)}; then: ${message}` : err instanceof StopError ? `${REFUSED}: ${message}` : message;
      if (await adapter.updateRunLocked(run.id, token, { status: "failed", last_error: error.slice(0, 500) }).catch(() => false))
        if (typeof err === "object" && err !== null) recorded.add(err);
    }
    throw err;
  } finally {
    await releaseQuietly(adapter, run.id, token, log);
  }

  const seconds = (Date.now() - started) / 1000;
  return {
    runId: run.id,
    written,
    skipped,
    seconds,
    rowsPerSecond: rows / Math.max(seconds, 0.001),
    authUsersPerSecond: authCount ? authCount / Math.max(authSeconds, 0.001) : null,
    endStatus,
    heldWith: hold,
    before,
    cancelled,
  };
}

async function writeAuthUsers(
  adapter: Adapter,
  runId: string,
  batch: Item<Record<string, unknown>>[],
  known: Map<string, RegistryItem>,
  concurrency: number,
  attempts: number,
  baseMs: number,
  log: (s: string) => void,
  beat: () => Promise<void> = async () => {}
) {
  let next = 0;
  // The first failure stops every worker from starting another user; the
  // ones in flight finish, and only then does the error propagate.
  let stopped = false;
  const one = async (b: Item<Record<string, unknown>>) => {
    const email = String(b.row.email);
    const n = Number(b.logicalId.split(":")[1]);
    const check = async () => {
      const existing = await adapter.getAuthUser(b.rowId);
      if (!existing) return false;
      if (existing.email !== email || existing.runId !== runId)
        throw new StopError(`auth user ${b.rowId} exists and is not this run's; refusing to adopt it`);
      if (!existing.loginBlocked) throw new StopError(`auth user ${b.rowId} exists without a sign-in ban; stopping`);
      return true;
    };
    // An intent left by an earlier attempt may or may not have become a
    // user: look before creating.
    if (known.has(b.logicalId) && (await retry(check, attempts, baseMs, log, "auth check"))) return;
    await retry(
      async () => {
        try {
          await adapter.createAuthUser({ id: b.rowId, email, runId, n });
        } catch (err) {
          // The response was lost or the user exists: either way, look.
          if (await check()) return;
          throw err;
        }
      },
      attempts, baseMs, log, `auth user ${n}`
    );
  };
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (!stopped && next < batch.length) {
      const b = batch[next++];
      try {
        await beat();
        await one(b);
      } catch (err) {
        stopped = true;
        throw err;
      }
    }
  });
  const settled = await Promise.allSettled(workers);
  const failure = settled.find((s) => s.status === "rejected");
  if (failure) throw (failure as PromiseRejectedResult).reason;
}

export { compareBaselines };
