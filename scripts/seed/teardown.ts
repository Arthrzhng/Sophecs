// Removes exactly one run's rows, in dependency order, and nothing else.
//
// What it deletes is the run's registry items (created or merely intended,
// since a crash can leave a row that was written and never marked), and
// every delete is also scoped by ownership: the sample marker, or the
// run's own users. Before anything goes, it looks for genuine rows that
// point at the run's rows:
// - a nullable reference (a genuine quiz result's challenge_from, a genuine
//   debate's challenge_id) is cleared, so the genuine row stays and stops
//   pointing at something about to disappear;
// - anything else (a genuine turn in a sample exchange, a genuine member of
//   a sample class, a genuine report or block) would be deleted with the
//   sample row, so teardown stops and lists it instead.
//
// It never restores anything: no old par, no old counts. The registry rows
// stay, marked deleted, with the run marked torn_down, as the audit record.

import { randomUUID } from "node:crypto";
import type { Adapter, Entanglement, Kind, RegistryItem, Table } from "./adapter";
import { StopError, LockLostError, STALE_LOCK_MINUTES, heartbeat, pulse, releaseQuietly } from "./engine";
import { snapshot, settledChecks, compareBaselines, type Baseline, type BaselineCheck } from "./baseline";

export interface TeardownPreview {
  runId: string;
  status: string;
  items: Record<string, { created: number; intended: number; deleted: number }>;
  /** Intents whose row was never written: marked deleted by teardown. */
  absent: number;
  /** Intents whose id is a row the run did not write: never touched, marked abandoned now or by an earlier pass. */
  foreign: { kind: Kind; rowId: string }[];
  entanglements: Entanglement[];
  blocking: Entanglement[];
}

const ORDER: { kind: Kind; table: Table | null }[] = [
  { kind: "class_member", table: "class_members" },
  { kind: "class", table: "classes" },
  { kind: "reading_response", table: "reading_responses" },
  { kind: "turn", table: "turns" },
  { kind: "exchange", table: "exchanges" },
  { kind: "debate", table: "debates" },
  { kind: "challenge", table: "challenges" },
  { kind: "quiz_result", table: "quiz_results" },
  { kind: "profile", table: "profiles" },
  { kind: "auth_user", table: null },
];

const MARKED_KIND: Partial<Record<Kind, true>> = { profile: true, quiz_result: true, challenge: true, debate: true, exchange: true };
const OWNER_OF: Partial<Record<Kind, string>> = { turn: "exchange_id", reading_response: "user_id", class: "owner_id", class_member: "user_id" };

/**
 * The run's registry items, keeping an item only when its row is proven to
 * be the run's: created items were proven when they were written; an
 * intended item (a crash between recording the intent and marking it) is
 * kept only if its row reads back marked, or owned by one of the run's
 * proven users or exchanges. Auth users are proven first, since the other
 * kinds' ownership rests on them. The rest are sorted out:
 * - absent: the row was never written, so there is nothing to delete; the
 *   intent is marked deleted;
 * - foreign: a row with that id exists and is not the run's (the collision
 *   the engine stops on); it is never touched, the intent is marked
 *   abandoned, and nothing pointing at it counts as a sample reference.
 */
async function loadItems(adapter: Adapter, runId: string) {
  const items = {} as Record<Kind, RegistryItem[]>;
  for (const { kind } of ORDER) items[kind] = await adapter.items(runId, kind);
  const absent: RegistryItem[] = [];
  const foreign: RegistryItem[] = [];
  const settle = (kind: Kind, proven: Set<string>, present: Set<string>) => {
    for (const i of items[kind].filter((x) => x.state === "intended")) {
      if (proven.has(i.row_id)) continue;
      (present.has(i.row_id) ? foreign : absent).push(i);
    }
    items[kind] = items[kind].filter((i) => i.state !== "intended" || proven.has(i.row_id));
  };
  {
    const proven = new Set<string>();
    const present = new Set<string>();
    for (const i of items.auth_user.filter((x) => x.state === "intended")) {
      const u = await adapter.getAuthUser(i.row_id);
      if (!u) continue;
      present.add(i.row_id);
      if (u.runId === runId) proven.add(i.row_id);
    }
    settle("auth_user", proven, present);
  }
  const owners = new Set([
    ...items.auth_user.filter((i) => i.state !== "abandoned").map((i) => i.row_id),
    ...items.exchange.filter((i) => i.state === "created").map((i) => i.row_id),
  ]);
  for (const { kind, table } of ORDER) {
    if (!table) continue;
    const unproven = items[kind].filter((i) => i.state === "intended");
    if (!unproven.length) continue;
    const rows = await adapter.selectByIds(table, unproven.map((i) => i.row_id));
    const key = (r: Record<string, unknown>) => (table === "class_members" ? `${r.class_id}:${r.user_id}` : String(r.id));
    const present = new Set(rows.map(key));
    const proven = new Set(
      rows.filter((r) => (MARKED_KIND[kind] ? r.is_sample === true : owners.has(String(r[OWNER_OF[kind]!])))).map(key)
    );
    settle(kind, proven, present);
  }
  return { items, absent, foreign };
}

const live = (items: RegistryItem[]) => items.filter((i) => i.state === "created" || i.state === "intended");

/** Genuine rows that point at this run's rows. Reads only. */
export async function findEntanglements(adapter: Adapter, items: Record<Kind, RegistryItem[]>): Promise<Entanglement[]> {
  const ids = (k: Kind) => new Set(live(items[k]).map((i) => i.row_id));
  const results = ids("quiz_result");
  const challenges = ids("challenge");
  const debates = ids("debate");
  const exchanges = ids("exchange");
  const turns = ids("turn");
  const classes = ids("class");
  const users = ids("auth_user");
  const out: Entanglement[] = [];
  const push = (table: string, column: string, rowId: unknown, pointsAt: unknown, nullable: boolean) =>
    out.push({ table, column, rowId: String(rowId), pointsAt: String(pointsAt), nullable });

  for (const r of await adapter.scan("quiz_results", ["id", "challenge_from", "user_id"], { sample: false })) {
    if (r.challenge_from && results.has(String(r.challenge_from))) push("quiz_results", "challenge_from", r.id, r.challenge_from, true);
    if (r.user_id && users.has(String(r.user_id))) push("quiz_results", "user_id", r.id, r.user_id, false);
  }
  for (const c of await adapter.scan("challenges", ["id", "challenger_result_id", "challengee_result_id", "challenger_debate_id", "challengee_debate_id"], { sample: false })) {
    if (results.has(String(c.challenger_result_id))) push("challenges", "challenger_result_id", c.id, c.challenger_result_id, false);
    if (c.challengee_result_id && results.has(String(c.challengee_result_id))) push("challenges", "challengee_result_id", c.id, c.challengee_result_id, true);
    if (c.challenger_debate_id && debates.has(String(c.challenger_debate_id))) push("challenges", "challenger_debate_id", c.id, c.challenger_debate_id, true);
    if (c.challengee_debate_id && debates.has(String(c.challengee_debate_id))) push("challenges", "challengee_debate_id", c.id, c.challengee_debate_id, true);
  }
  for (const d of await adapter.scan("debates", ["id", "challenge_id", "parent_debate_id", "user_id"], { sample: false })) {
    if (d.challenge_id && challenges.has(String(d.challenge_id))) push("debates", "challenge_id", d.id, d.challenge_id, true);
    if (d.parent_debate_id && debates.has(String(d.parent_debate_id))) push("debates", "parent_debate_id", d.id, d.parent_debate_id, false);
    if (d.user_id && users.has(String(d.user_id))) push("debates", "user_id", d.id, d.user_id, false);
  }
  for (const e of await adapter.scan("exchanges", ["id", "debate_a", "debate_b", "user_a", "user_b"], { sample: false })) {
    for (const col of ["debate_a", "debate_b"]) if (debates.has(String(e[col]))) push("exchanges", col, e.id, e[col], false);
    for (const col of ["user_a", "user_b"]) if (e[col] && users.has(String(e[col]))) push("exchanges", col, e.id, e[col], false);
  }
  for (const t of await adapter.scan("turns", ["id", "exchange_id", "author_id"])) {
    if (exchanges.has(String(t.exchange_id)) && !turns.has(String(t.id))) push("turns", "exchange_id", t.id, t.exchange_id, false);
  }
  for (const r of await adapter.scan("reports", ["id", "turn_id", "reporter_id"])) {
    if (r.turn_id && turns.has(String(r.turn_id))) push("reports", "turn_id", r.id, r.turn_id, false);
  }
  for (const m of await adapter.scan("class_members", ["class_id", "user_id"])) {
    if (classes.has(String(m.class_id)) && !users.has(String(m.user_id))) push("class_members", "class_id", `${m.class_id}:${m.user_id}`, m.class_id, false);
  }
  for (const b of await adapter.scan("blocks", ["blocker_id", "blocked_id"])) {
    const blocker = String(b.blocker_id);
    const blocked = String(b.blocked_id);
    if (users.has(blocked) && !users.has(blocker)) push("blocks", "blocked_id", `${blocker}:${blocked}`, blocked, false);
    if (users.has(blocker) && !users.has(blocked)) push("blocks", "blocker_id", `${blocker}:${blocked}`, blocker, false);
  }
  for (const a of await adapter.scan("ai_calls", ["id", "user_id"])) {
    if (a.user_id && users.has(String(a.user_id))) push("ai_calls", "user_id", a.id, a.user_id, false);
  }
  return out;
}

export async function preview(adapter: Adapter, runId: string): Promise<TeardownPreview> {
  await adapter.checkSchema();
  const run = await adapter.getRun(runId);
  if (!run) throw new StopError(`no seed run ${runId}`);
  const { items, absent, foreign } = await loadItems(adapter, runId);
  const summary: TeardownPreview["items"] = {};
  for (const { kind } of ORDER) {
    const list = items[kind];
    summary[kind] = {
      created: list.filter((i) => i.state === "created").length,
      intended: list.filter((i) => i.state === "intended").length,
      deleted: list.filter((i) => i.state === "deleted").length,
    };
  }
  const entanglements = await findEntanglements(adapter, items);
  return {
    runId,
    status: run.status,
    items: summary,
    absent: absent.length,
    foreign: [...foreign, ...ORDER.flatMap(({ kind }) => items[kind].filter((i) => i.state === "abandoned"))].map((i) => ({
      kind: i.kind,
      rowId: i.row_id,
    })),
    entanglements,
    blocking: entanglements.filter((e) => !e.nullable),
  };
}

export interface TeardownReport {
  deleted: Record<string, number>;
  cleared: number;
  before: Baseline;
  after: Baseline;
  /** compareBaselines(before, after), read again before a failure is reported. */
  checks: BaselineCheck[];
  leftOver: Record<string, number>;
}

export async function teardown(
  adapter: Adapter,
  runId: string,
  opts: { log?: (s: string) => void; batchSize?: number; breakStaleLock?: boolean; rereadMs?: number } = {}
): Promise<TeardownReport> {
  const log = opts.log ?? (() => {});
  const size = opts.batchSize ?? 250;
  const p = await preview(adapter, runId);
  if (p.blocking.length)
    throw new StopError(
      `teardown would delete ${p.blocking.length} genuine row(s) that point at this run's rows, e.g. ${p.blocking[0].table}.${p.blocking[0].column} ${p.blocking[0].rowId}; stopping`
    );
  const before = await snapshot(adapter);
  const token = randomUUID();
  if (opts.breakStaleLock && (await adapter.breakStaleLock(runId, STALE_LOCK_MINUTES))) log(`cleared a stale lock on ${runId}`);
  if (!(await adapter.acquireLock(runId, token)))
    throw new StopError(`run ${runId} is locked by another process (if that process died, add --break-stale-lock after ${STALE_LOCK_MINUTES} minutes)`);
  const deleted: Record<string, number> = {};
  try {
    if (!(await adapter.updateRunLocked(runId, token, { status: "tearing_down" })))
      throw new LockLostError(`run ${runId}'s lock was taken before teardown began`);
    for (const e of p.entanglements) await adapter.clearReference(e);
    log(`cleared ${p.entanglements.length} genuine reference(s) to sample rows`);
    const { items, absent, foreign } = await loadItems(adapter, runId);
    const beat = pulse(adapter, runId, token);
    // Settle the intents that never became the run's rows, so the registry
    // ends with nothing left in an open state.
    for (const kind of new Set(absent.map((i) => i.kind)))
      await adapter.setState(runId, kind, absent.filter((i) => i.kind === kind).map((i) => i.logical_id), "deleted");
    for (const kind of new Set(foreign.map((i) => i.kind)))
      await adapter.setState(runId, kind, foreign.filter((i) => i.kind === kind).map((i) => i.logical_id), "abandoned");
    if (absent.length || foreign.length) log(`settled ${absent.length} intent(s) never written, ${foreign.length} abandoned on a row the run did not write`);
    const owners = [...live(items.auth_user).map((i) => i.row_id), ...live(items.exchange).map((i) => i.row_id)];
    for (const { kind, table } of ORDER) {
      let list = live(items[kind]);
      if (kind === "debate") {
        // Revisions first: an original cannot go while a revision names it.
        list = [...list.filter((i) => i.logical_id.startsWith("debate:r:")), ...list.filter((i) => !i.logical_id.startsWith("debate:r:"))];
        await adapter.unlinkChallenges(live(items.challenge).map((i) => i.row_id));
      }
      if (kind === "quiz_result") await adapter.clearSampleChallengeFrom(list.map((i) => i.row_id));
      for (let i = 0; i < list.length; i += size) {
        const batch = list.slice(i, i + size);
        await heartbeat(adapter, runId, token);
        if (table) await adapter.deleteOwned(table, batch.map((b) => b.row_id), owners);
        else
          for (const b of batch) {
            await beat();
            const u = await adapter.getAuthUser(b.row_id);
            if (!u) continue;
            if (u.runId !== runId) throw new StopError(`auth user ${b.row_id} does not carry run ${runId}; not deleting it`);
            await adapter.deleteAuthUser(b.row_id);
          }
        await heartbeat(adapter, runId, token);
        await adapter.setState(runId, kind, batch.map((b) => b.logical_id), "deleted");
      }
      deleted[kind] = list.length;
      log(`${kind}: ${list.length} deleted`);
    }
    // Proven by id, not by counts: none of the run's rows is still there.
    // Abandoned intents are left out (their rows are not the run's), and a
    // row found at a settled id counts only if it is the run's: marked, or
    // owned by the run's users or exchanges.
    const leftOver: Record<string, number> = {};
    const ownerSet = new Set(owners);
    for (const { kind, table } of ORDER) {
      if (!table) continue;
      const ids = items[kind].filter((i) => i.state !== "abandoned").map((i) => i.row_id);
      let n = 0;
      for (let i = 0; i < ids.length; i += size) {
        const rows = await adapter.selectByIds(table, ids.slice(i, i + size));
        n += rows.filter((r) => (MARKED_KIND[kind] ? r.is_sample === true : ownerSet.has(String(r[OWNER_OF[kind]!])))).length;
      }
      leftOver[kind] = n;
    }
    let authLeft = 0;
    for (const i of items.auth_user.filter((x) => x.state !== "abandoned")) {
      await beat();
      const u = await adapter.getAuthUser(i.row_id);
      if (u && u.runId === runId) authLeft++;
    }
    leftOver.auth_user = authLeft;
    const remaining = Object.values(leftOver).reduce((a, b) => a + b, 0);
    if (remaining) throw new StopError(`${remaining} of the run's rows are still present after teardown`);
    // The audit count is what the registry now says is deleted, so a
    // teardown resumed after a crash records the whole run, not its last pass.
    const totals: Record<string, number> = {};
    for (const { kind } of ORDER) totals[kind] = (await adapter.items(runId, kind)).filter((i) => i.state === "deleted").length;
    const ended = await adapter.updateRunLocked(runId, token, {
      status: "torn_down",
      last_error: null,
      counts: { ...((await adapter.getRun(runId))?.counts ?? {}), deleted: totals },
    });
    if (!ended) throw new LockLostError(`run ${runId}'s lock was taken before teardown could record its end`);
    const { now: after, checks } = await settledChecks(adapter, (now) => compareBaselines(before, now), { waitMs: opts.rereadMs });
    return { deleted, cleared: p.entanglements.length, before, after, checks, leftOver };
  } catch (err) {
    if (!(err instanceof LockLostError))
      await adapter.updateRunLocked(runId, token, { last_error: `teardown: ${String((err as Error).message).slice(0, 480)}` }).catch(() => false);
    throw err;
  } finally {
    await releaseQuietly(adapter, runId, token, log);
  }
}
