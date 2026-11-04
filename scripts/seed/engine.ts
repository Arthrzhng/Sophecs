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
}

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
      plan_hash: plan.manifestHash,
      generator_version: plan.generatorVersion,
      seed: plan.seed,
      window_from: plan.window.from,
      window_to: plan.window.to,
      counts: plan.counts,
      lock_token: null,
      locked_at: null,
      last_error: null,
    };
    await adapter.insertRun(fresh);
    run = fresh;
  }
  if (run.plan_hash !== plan.manifestHash || run.generator_version !== plan.generatorVersion || run.seed !== plan.seed)
    throw new StopError(`run ${run.id} was started from a different plan`);
  if (run.status === "tearing_down" || run.status === "torn_down")
    throw new StopError(`run ${run.id} is ${run.status}; it cannot be resumed`);
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
  if (!(await adapter.updateRunLocked(run.id, token, { status: "running", last_error: null })))
    throw new LockLostError(`run ${run.id}'s lock was taken before the run began`);

  const owners = ownerIds(ds);
  const written: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  let rows = 0;
  let authSeconds = 0;
  let authCount = 0;
  let cancelled = false;

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
    const complete = !cancelled && limit === Infinity;
    const recorded = await adapter.updateRunLocked(run.id, token, {
      status: complete ? "complete" : "running",
      last_error: cancelled ? "cancelled; run the same command again to resume" : null,
      counts: { ...plan.counts, cohortLimit: Number.isFinite(limit) ? limit : null },
    });
    if (!recorded) throw new LockLostError(`run ${run.id}'s lock was taken before the run could record its end`);
  } catch (err) {
    // Only while still holding the lock: a process that lost it must not
    // write over the state of the one that took it.
    if (!(err instanceof LockLostError))
      await adapter.updateRunLocked(run.id, token, { status: "failed", last_error: String((err as Error).message).slice(0, 500) }).catch(() => false);
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
