// An in-memory database for the engine's tests: the same ownership rules as
// the real adapters, plus switches to make writes fail, or succeed and then
// report failure (the uncertain response a retry must not duplicate).

import {
  MARKED,
  OWNER_COLUMN,
  type Adapter,
  type Entanglement,
  type ItemState,
  type Kind,
  type RegistryItem,
  type ScanTable,
  type SeedRun,
  type Table,
} from "./adapter";

type Row = Record<string, unknown>;

export interface Faults {
  /** Fail this many calls of the named operation before succeeding. */
  failBefore?: Partial<Record<string, number>>;
  /** Apply the write, then throw, this many times. */
  failAfter?: Partial<Record<string, number>>;
}

const key = (table: string, row: Row) =>
  table === "class_members" ? `${row.class_id}:${row.user_id}` : String(row.id);

export class MemoryAdapter implements Adapter {
  readonly target = "memory" as const;
  tables = new Map<string, Map<string, Row>>();
  authUsers = new Map<string, { id: string; email: string; runId: string | null; loginBlocked: boolean }>();
  runs = new Map<string, SeedRun>();
  registry = new Map<string, RegistryItem>();
  calls: Record<string, number> = {};

  constructor(public faults: Faults = {}) {
    for (const t of [
      "profiles", "quiz_results", "challenges", "debates", "exchanges", "turns",
      "reading_responses", "classes", "class_members", "debate_topics", "blocks", "reports", "ai_calls",
    ])
      this.tables.set(t, new Map());
  }

  describe() {
    return "memory";
  }

  private async fault(op: string, write: () => void) {
    this.calls[op] = (this.calls[op] ?? 0) + 1;
    const before = this.faults.failBefore?.[op] ?? 0;
    if (before > 0) {
      this.faults.failBefore![op] = before - 1;
      throw new Error(`injected failure before ${op}`);
    }
    write();
    const after = this.faults.failAfter?.[op] ?? 0;
    if (after > 0) {
      this.faults.failAfter![op] = after - 1;
      throw new Error(`injected failure after ${op} (the write happened)`);
    }
  }

  table(t: string) {
    return this.tables.get(t)!;
  }

  async checkSchema() {}

  async scan(table: ScanTable, columns: string[], where?: { sample?: boolean }) {
    return [...this.table(table).values()]
      .filter((r) => where?.sample === undefined || Boolean(r.is_sample) === where.sample)
      .map((r) => (columns[0] === "*" ? { ...r } : Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))));
  }

  async count(table: ScanTable, where?: { sample?: boolean; eloBelow?: number }) {
    const rows = await this.scan(table, ["id", "elo"], where);
    return where?.eloBelow === undefined ? rows.length : rows.filter((r) => Number(r.elo) < where.eloBelow!).length;
  }

  async parWindow(topic: string, n: number) {
    return [...this.table("debates").values()]
      .filter((d) => d.topic_slug === topic && d.kind === "original" && !d.is_sample && d.elo_before !== null && d.elo_before !== undefined)
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, n)
      .map((d) => Number(d.elo_before));
  }

  async percentile(elo: number) {
    const genuine = [...this.table("profiles").values()].filter((p) => !p.is_sample);
    if (genuine.length === 0) return 0;
    return genuine.filter((p) => Number(p.elo) < elo).length / genuine.length;
  }

  async getRun(id: string) {
    return this.runs.get(id) ?? null;
  }
  async listRuns() {
    return [...this.runs.values()];
  }
  async insertRun(run: SeedRun) {
    if (this.runs.has(run.id)) throw new Error("duplicate run");
    this.runs.set(run.id, { ...run });
  }
  async updateRun(id: string, patch: Partial<SeedRun>) {
    const r = this.runs.get(id);
    if (r) this.runs.set(id, { ...r, ...patch });
  }
  async updateRunLocked(id: string, token: string, patch: Partial<SeedRun>) {
    const r = this.runs.get(id);
    if (!r || r.lock_token !== token) return false;
    this.runs.set(id, { ...r, ...patch });
    return true;
  }
  async acquireLock(id: string, token: string) {
    const r = this.runs.get(id);
    if (!r || r.lock_token) return false;
    r.lock_token = token;
    r.locked_at = new Date().toISOString();
    return true;
  }
  async releaseLock(id: string, token: string) {
    const r = this.runs.get(id);
    if (r && r.lock_token === token) {
      r.lock_token = null;
      r.locked_at = null;
    }
  }

  async refreshLock(id: string, token: string) {
    const r = this.runs.get(id);
    if (!r || r.lock_token !== token) return false;
    r.locked_at = new Date().toISOString();
    return true;
  }
  async breakStaleLock(id: string, minutes: number) {
    const r = this.runs.get(id);
    if (!r || !r.lock_token || !r.locked_at || Date.parse(r.locked_at) > Date.now() - minutes * 60_000) return false;
    r.lock_token = null;
    r.locked_at = null;
    return true;
  }
  async recordIntents(items: Omit<RegistryItem, "state">[]) {
    await this.fault("recordIntents", () => {
      for (const it of items) {
        for (const other of this.registry.values())
          if (other.kind === it.kind && other.row_id === it.row_id && other.run_id !== it.run_id)
            throw new Error(`row ${it.row_id} belongs to run ${other.run_id}`);
        const k = `${it.run_id}|${it.kind}|${it.logical_id}`;
        if (!this.registry.has(k)) this.registry.set(k, { ...it, state: "intended" });
      }
    });
  }
  async setState(runId: string, kind: Kind, logicalIds: string[], state: ItemState) {
    for (const l of logicalIds) {
      const it = this.registry.get(`${runId}|${kind}|${l}`);
      if (it) it.state = state;
    }
  }
  async items(runId: string, kind: Kind) {
    return [...this.registry.values()].filter((i) => i.run_id === runId && i.kind === kind);
  }

  async createAuthUser(u: { id: string; email: string; runId: string; n: number }) {
    await this.fault("createAuthUser", () => {
      if (this.authUsers.has(u.id)) throw new Error("user already exists");
      this.authUsers.set(u.id, { id: u.id, email: u.email, runId: u.runId, loginBlocked: true });
    });
  }
  async getAuthUser(id: string) {
    return this.authUsers.get(id) ?? null;
  }
  async deleteAuthUser(id: string) {
    this.authUsers.delete(id);
    // ON DELETE CASCADE / SET NULL, as the real schema has them.
    for (const t of ["profiles"]) this.table(t).delete(id);
    for (const [k, r] of this.table("reading_responses")) if (r.user_id === id) this.table("reading_responses").delete(k);
    for (const [k, r] of this.table("class_members")) if (r.user_id === id) this.table("class_members").delete(k);
    for (const [k, r] of this.table("blocks")) if (r.blocker_id === id || r.blocked_id === id) this.table("blocks").delete(k);
    for (const r of this.table("debates").values()) if (r.user_id === id) r.user_id = null;
  }

  async insertIgnore(table: Table, rows: Row[]) {
    await this.fault(`insert:${table}`, () => {
      for (const row of rows) {
        const k = key(table, row);
        if (!this.table(table).has(k)) this.table(table).set(k, { ...row });
      }
    });
  }
  async selectByIds(table: Table, ids: string[]) {
    return ids.map((id) => this.table(table).get(id)).filter((r): r is Row => Boolean(r)).map((r) => ({ ...r }));
  }
  async updateSampleRows(table: "profiles", rows: { id: string; patch: Record<string, unknown> }[]) {
    for (const { id, patch } of rows) {
      const r = this.table(table).get(id);
      if (r && r.is_sample === true) Object.assign(r, patch);
    }
  }
  async linkChallenge(id: string, a: string, b: string) {
    const r = this.table("challenges").get(id);
    if (r && r.is_sample) Object.assign(r, { challenger_debate_id: a, challengee_debate_id: b });
  }
  async unlinkChallenges(ids: string[]) {
    for (const id of ids) {
      const r = this.table("challenges").get(id);
      if (r && r.is_sample) Object.assign(r, { challenger_debate_id: null, challengee_debate_id: null });
    }
  }
  async clearSampleChallengeFrom(ids: string[]) {
    for (const id of ids) {
      const r = this.table("quiz_results").get(id);
      if (r && r.is_sample) r.challenge_from = null;
    }
  }
  async deleteOwned(table: Table, ids: string[], ownerIds: string[]) {
    const owners = new Set(ownerIds);
    for (const id of ids) {
      const r = this.table(table).get(id);
      if (!r) continue;
      const owned = MARKED.has(table)
        ? r.is_sample === true
        : owners.has(String(r[OWNER_COLUMN[table as keyof typeof OWNER_COLUMN]]));
      if (owned) {
        this.table(table).delete(id);
        if (table === "exchanges")
          for (const [k, t] of this.table("turns")) if (t.exchange_id === id) this.table("turns").delete(k);
        if (table === "classes")
          for (const [k, m] of this.table("class_members")) if (m.class_id === id) this.table("class_members").delete(k);
      }
    }
  }
  async clearReference(e: Entanglement) {
    const r = this.table(e.table).get(e.rowId);
    if (r && r[e.column] === e.pointsAt && !r.is_sample) r[e.column] = null;
  }
  async close() {}
}
