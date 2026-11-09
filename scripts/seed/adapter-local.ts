// The local adapter: psql against a Postgres on this machine, set up with
// scripts/local-auth-shim.sql and every migration (scripts/seed-local.ts
// --create-db does that in a database of its own). There is no Supabase
// Auth here: an "auth user" is a row in the shim's auth.users, and nothing
// can sign in to a bare Postgres, sample or not.
//
// The guard in env.ts has already refused anything but 127.0.0.1 or
// localhost before this file is reached.

import { spawnSync } from "node:child_process";
import type { LocalTarget } from "./env";
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

const TAG = "$seedjson$";
const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`not a plain identifier: ${name}`);
  return `"${name}"`;
}

function json(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.includes(TAG)) throw new Error("payload contains the quoting tag");
  return `${TAG}${text}${TAG}`;
}

const textArray = (ids: string[]) => `array(select json_array_elements_text(${json(ids)}::json))`;

export class LocalAdapter implements Adapter {
  readonly target = "local" as const;

  constructor(private t: LocalTarget, private database = t.database) {}

  describe() {
    return `local ${this.t.host}:${this.t.port}/${this.database}`;
  }

  sql(text: string, database = this.database): string {
    const url = new URL(this.t.databaseUrl);
    // A clean environment: no PG* variable from the shell can redirect psql.
    const env: Record<string, string> = { PATH: process.env.PATH ?? "/usr/bin:/bin", PGCONNECT_TIMEOUT: "5" };
    if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
    const res = spawnSync(
      "psql",
      ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", this.t.host, "-p", String(this.t.port), "-U", this.t.user, "-d", database, "-f", "-"],
      { input: text, env: env as unknown as NodeJS.ProcessEnv, encoding: "utf8", maxBuffer: 1 << 30 }
    );
    if (res.status !== 0) throw new Error(`psql: ${(res.stderr || "").trim().split("\n").slice(-3).join(" ")}`);
    return res.stdout;
  }

  query<T = Record<string, unknown>>(select: string): T[] {
    const out = this.sql(`select coalesce(json_agg(q), '[]'::json) from (${select}) q;`).trim();
    return JSON.parse(out || "[]") as T[];
  }

  async checkSchema() {
    const [r] = this.query<{ marked: number; registry: number }>(
      `select (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'is_sample'
                and table_name in ('profiles','quiz_results','debates','challenges','exchanges'))::int as marked,
              (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('seed_runs','seed_run_items'))::int as registry`
    );
    if (r.marked !== 5 || r.registry !== 2) throw new Error("migration 0023_sample_activity is not applied to this database");
  }

  async scan(table: ScanTable, columns: string[], where?: { sample?: boolean }) {
    const cols = columns.length === 1 && columns[0] === "*" ? "*" : columns.map(ident).join(", ");
    const filter = where?.sample === undefined ? "" : ` where is_sample = ${where.sample ? "true" : "false"}`;
    return this.query(`select ${cols} from public.${ident(table)}${filter}`);
  }

  async count(table: ScanTable, where?: { sample?: boolean; eloBelow?: number; seeking?: boolean }) {
    const conds = [
      ...(where?.sample === undefined ? [] : [`is_sample = ${where.sample ? "true" : "false"}`]),
      ...(where?.eloBelow === undefined ? [] : [`elo < ${Number(where.eloBelow)}`]),
      ...(where?.seeking ? ["seeking_counterpart_at is not null"] : []),
    ];
    const filter = conds.length ? ` where ${conds.join(" and ")}` : "";
    return Number(this.sql(`select count(*) from public.${ident(table)}${filter};`).trim());
  }

  async parWindow(topic: string, n: number) {
    return this.query<{ elo_before: string }>(
      `select elo_before from public.debates where topic_slug = ${json(topic)}::json #>> '{}' and kind = 'original' and not is_sample and elo_before is not null order by created_at desc limit ${Number(n)}`
    ).map((r) => Number(r.elo_before));
  }

  async percentile(elo: number) {
    const v = this.sql(`select public.elo_percentile(${Number(elo)});`).trim();
    return v === "" ? null : Number(v);
  }

  async getRun(id: string) {
    return this.query<SeedRun>(`select * from public.seed_runs where id = ${json(id)}::json #>> '{}'`)[0] ?? null;
  }
  async listRuns() {
    return this.query<SeedRun>(`select * from public.seed_runs order by created_at`);
  }
  async insertRun(run: SeedRun) {
    this.sql(`insert into public.seed_runs select * from json_populate_record(null::public.seed_runs, ${json({ ...run, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })});`);
  }
  async updateRun(id: string, patch: Partial<SeedRun>) {
    const sets = Object.keys(patch).map((k) => `${ident(k)} = (json_populate_record(null::public.seed_runs, ${json(patch)})).${ident(k)}`);
    this.sql(`update public.seed_runs set ${[...sets, "updated_at = now()"].join(", ")} where id = ${json(id)}::json #>> '{}';`);
  }
  async updateRunLocked(id: string, token: string, patch: Partial<SeedRun>) {
    const sets = Object.keys(patch).map((k) => `${ident(k)} = (json_populate_record(null::public.seed_runs, ${json(patch)})).${ident(k)}`);
    const out = this.sql(
      `update public.seed_runs set ${[...sets, "updated_at = now()"].join(", ")}
       where id = ${json(id)}::json #>> '{}' and lock_token = ${json(token)}::json #>> '{}' returning id;`
    ).trim();
    return out.length > 0;
  }
  async acquireLock(id: string, token: string) {
    const out = this.sql(
      `update public.seed_runs set lock_token = ${json(token)}::json #>> '{}', locked_at = now() where id = ${json(id)}::json #>> '{}' and lock_token is null returning id;`
    ).trim();
    return out.length > 0;
  }
  async releaseLock(id: string, token: string) {
    this.sql(`update public.seed_runs set lock_token = null, locked_at = null where id = ${json(id)}::json #>> '{}' and lock_token = ${json(token)}::json #>> '{}';`);
  }
  async refreshLock(id: string, token: string) {
    const out = this.sql(
      `update public.seed_runs set locked_at = now() where id = ${json(id)}::json #>> '{}' and lock_token = ${json(token)}::json #>> '{}' returning id;`
    ).trim();
    return out.length > 0;
  }
  async breakStaleLock(id: string, minutes: number) {
    const out = this.sql(
      `update public.seed_runs set lock_token = null, locked_at = null
       where id = ${json(id)}::json #>> '{}' and lock_token is not null and locked_at < now() - make_interval(mins => ${Math.floor(minutes)}) returning id;`
    ).trim();
    return out.length > 0;
  }
  async recordIntents(items: Omit<RegistryItem, "state">[]) {
    if (!items.length) return;
    this.sql(
      `insert into public.seed_run_items (run_id, kind, logical_id, row_id)
       select run_id, kind, logical_id, row_id from json_to_recordset(${json(items)}) as x(run_id text, kind text, logical_id text, row_id text)
       on conflict (run_id, kind, logical_id) do nothing;`
    );
  }
  async setState(runId: string, kind: Kind, logicalIds: string[], state: ItemState) {
    if (!logicalIds.length) return;
    this.sql(
      `update public.seed_run_items set state = ${json(state)}::json #>> '{}', updated_at = now()
       where run_id = ${json(runId)}::json #>> '{}' and kind = ${json(kind)}::json #>> '{}' and logical_id = any(${textArray(logicalIds)});`
    );
  }
  async items(runId: string, kind: Kind, logicalIds?: string[]) {
    if (logicalIds && !logicalIds.length) return [];
    const only = logicalIds ? ` and logical_id = any(${textArray(logicalIds)})` : "";
    return this.query<RegistryItem>(
      `select run_id, kind, logical_id, row_id, state from public.seed_run_items where run_id = ${json(runId)}::json #>> '{}' and kind = ${json(kind)}::json #>> '{}'${only}`
    );
  }
  async registryCount(runId: string, kind: Kind, state: ItemState) {
    return Number(
      this.sql(
        `select count(*) from public.seed_run_items where run_id = ${json(runId)}::json #>> '{}' and kind = ${json(kind)}::json #>> '{}' and state = ${json(state)}::json #>> '{}';`
      ).trim()
    );
  }

  async createAuthUser(u: { id: string; email: string }) {
    this.sql(`insert into auth.users (id, email) values ((${json(u.id)}::json #>> '{}')::uuid, ${json(u.email)}::json #>> '{}');`);
  }
  async getAuthUser(id: string) {
    const [r] = this.query<{ id: string; email: string }>(`select id::text, email from auth.users where id::text = ${json(id)}::json #>> '{}'`);
    if (!r) return null;
    const m = /^seed\+(.+)-\d+-[a-z0-9]{12}@sophecs\.test$/.exec(r.email ?? "");
    // A bare Postgres has no sign-in at all; nothing here can log in.
    return { id: r.id, email: r.email, runId: m ? m[1] : null, loginBlocked: true };
  }
  async deleteAuthUser(id: string) {
    this.sql(`delete from auth.users where id::text = ${json(id)}::json #>> '{}' and email like 'seed+%@sophecs.test';`);
  }

  async insertIgnore(table: Table, rows: Record<string, unknown>[], conflict: string[]) {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]).map(ident).join(", ");
    this.sql(
      `insert into public.${ident(table)} (${cols})
       select ${cols} from json_populate_recordset(null::public.${ident(table)}, ${json(rows)})
       on conflict (${conflict.map(ident).join(", ")}) do nothing;`
    );
  }
  async selectByIds(table: Table, ids: string[], columns?: string[]) {
    if (!ids.length) return [];
    const key = table === "class_members" ? `(class_id || ':' || user_id::text)` : "id::text";
    const cols = columns ? columns.map(ident).join(", ") : "*";
    return this.query(`select ${cols} from public.${ident(table)} where ${key} = any(${textArray(ids)})`);
  }
  async updateSampleRows(table: "profiles", rows: { id: string; patch: Record<string, unknown> }[]) {
    // One statement per row, each scoped to is_sample; the values go
    // through json_populate_record, so types are the table's own.
    const statements = rows.map(({ id, patch }) => {
      const sets = Object.keys(patch).map((k) => `${ident(k)} = (json_populate_record(null::public.${ident(table)}, ${json(patch)})).${ident(k)}`);
      return `update public.${ident(table)} set ${sets.join(", ")} where id::text = ${json(id)}::json #>> '{}' and is_sample;`;
    });
    if (statements.length) this.sql(statements.join("\n"));
  }
  async linkChallenge(id: string, a: string, b: string) {
    this.sql(
      `update public.challenges set challenger_debate_id = ${json(a)}::json #>> '{}', challengee_debate_id = ${json(b)}::json #>> '{}'
       where id = ${json(id)}::json #>> '{}' and is_sample;`
    );
  }
  async unlinkChallenges(ids: string[]) {
    if (!ids.length) return;
    this.sql(`update public.challenges set challenger_debate_id = null, challengee_debate_id = null where id::text = any(${textArray(ids)}) and is_sample;`);
  }
  async clearSampleChallengeFrom(ids: string[]) {
    if (!ids.length) return;
    this.sql(`update public.quiz_results set challenge_from = null where id::text = any(${textArray(ids)}) and is_sample;`);
  }
  async deleteOwned(table: Table, ids: string[], ownerIds: string[]) {
    if (!ids.length) return;
    if (MARKED.has(table)) {
      this.sql(`delete from public.${ident(table)} where id::text = any(${textArray(ids)}) and is_sample;`);
      return;
    }
    const owner = ident(OWNER_COLUMN[table as keyof typeof OWNER_COLUMN]);
    const key = table === "class_members" ? `(class_id || ':' || user_id::text)` : "id::text";
    this.sql(`delete from public.${ident(table)} where ${key} = any(${textArray(ids)}) and ${owner}::text = any(${textArray(ownerIds)});`);
  }
  async clearReference(e: Entanglement) {
    const marked = MARKED.has(e.table as Table) ? " and not is_sample" : "";
    this.sql(
      `update public.${ident(e.table)} set ${ident(e.column)} = null
       where id = ${json(e.rowId)}::json #>> '{}' and ${ident(e.column)}::text = ${json(e.pointsAt)}::json #>> '{}'${marked};`
    );
  }
  async close() {}
}
