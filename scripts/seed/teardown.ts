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
import { StopError, LockLostError, STALE_LOCK_MINUTES, heartbeat } from "./engine";
import { snapshot, type Baseline } from "./baseline";

export interface TeardownPreview {
  runId: string;
  status: string;
  items: Record<string, { created: number; intended: number; deleted: number }>;
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
 * intended item is kept only if its row reads back marked, or owned by one
 * of the run's users or exchanges. An intent whose id turned out to be a
 * genuine row (the collision the engine stops on) is dropped here, so
 * nothing that points at that genuine row is treated as a sample reference.
 */
async function loadItems(adapter: Adapter, runId: string) {
  const out = {} as Record<Kind, RegistryItem[]>;
  for (const { kind } of ORDER) out[kind] = await adapter.items(runId, kind);
  const owners = new Set([
    ...out.auth_user.map((i) => i.row_id),
    ...out.exchange.filter((i) => i.state === "created").map((i) => i.row_id),
  ]);
  for (const { kind, table } of ORDER) {
    const unproven = out[kind].filter((i) => i.state === "intended");
    if (!unproven.length) continue;
    let proven = new Set<string>();
    if (table) {
      const rows = await adapter.selectByIds(table, unproven.map((i) => i.row_id));
      proven = new Set(
        rows
          .filter((r) => (MARKED_KIND[kind] ? r.is_sample === true : owners.has(String(r[OWNER_OF[kind]!]))))
          .map((r) => (table === "class_members" ? `${r.class_id}:${r.user_id}` : String(r.id)))
      );
    } else {
      for (const i of unproven) {
        const u = await adapter.getAuthUser(i.row_id);
        if (u && u.runId === runId) proven.add(i.row_id);
      }
    }
    out[kind] = out[kind].filter((i) => i.state !== "intended" || proven.has(i.row_id));
  }
  return out;
}

const live = (items: RegistryItem[]) => items.filter((i) => i.state !== "deleted");

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
  const items = await loadItems(adapter, runId);
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
  return { runId, status: run.status, items: summary, entanglements, blocking: entanglements.filter((e) => !e.nullable) };
}

export interface TeardownReport {
  deleted: Record<string, number>;
  cleared: number;
  before: Baseline;
  after: Baseline;
  leftOver: Record<string, number>;
}

export async function teardown(
  adapter: Adapter,
  runId: string,
  opts: { log?: (s: string) => void; batchSize?: number; breakStaleLock?: boolean } = {}
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
    await adapter.updateRun(runId, { status: "tearing_down" });
    for (const e of p.entanglements) await adapter.clearReference(e);
    log(`cleared ${p.entanglements.length} genuine reference(s) to sample rows`);
    const items = await loadItems(adapter, runId);
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
            const u = await adapter.getAuthUser(b.row_id);
            if (!u) continue;
            if (u.runId !== runId) throw new StopError(`auth user ${b.row_id} does not carry run ${runId}; not deleting it`);
            await adapter.deleteAuthUser(b.row_id);
          }
        await adapter.setState(runId, kind, batch.map((b) => b.logical_id), "deleted");
      }
      deleted[kind] = list.length;
      log(`${kind}: ${list.length} deleted`);
    }
    // Proven by id, not by counts: none of the run's rows is still there.
    const leftOver: Record<string, number> = {};
    for (const { kind, table } of ORDER) {
      if (!table) continue;
      const ids = items[kind].map((i) => i.row_id);
      let n = 0;
      for (let i = 0; i < ids.length; i += size) n += (await adapter.selectByIds(table, ids.slice(i, i + size))).length;
      leftOver[kind] = n;
    }
    let authLeft = 0;
    for (const i of items.auth_user) if (await adapter.getAuthUser(i.row_id)) authLeft++;
    leftOver.auth_user = authLeft;
    const remaining = Object.values(leftOver).reduce((a, b) => a + b, 0);
    if (remaining) throw new StopError(`${remaining} of the run's rows are still present after teardown`);
    // The audit count is what the registry now says is deleted, so a
    // teardown resumed after a crash records the whole run, not its last pass.
    const totals: Record<string, number> = {};
    for (const { kind } of ORDER) totals[kind] = (await adapter.items(runId, kind)).filter((i) => i.state === "deleted").length;
    await adapter.updateRun(runId, { status: "torn_down", last_error: null, counts: { ...((await adapter.getRun(runId))?.counts ?? {}), deleted: totals } });
    const after = await snapshot(adapter);
    return { deleted, cleared: p.entanglements.length, before, after, leftOver };
  } catch (err) {
    if (!(err instanceof LockLostError))
      await adapter.updateRun(runId, { last_error: `teardown: ${String((err as Error).message).slice(0, 480)}` });
    throw err;
  } finally {
    await adapter.releaseLock(runId, token);
  }
}
