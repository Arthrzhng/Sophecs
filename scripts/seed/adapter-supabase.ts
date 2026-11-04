// The production adapter: the Data API for rows and the Auth admin API for
// users, both with the service key from .env.seed.production (env.ts has
// already checked the URL and key against the project ref).
//
// Sample users cannot sign in, by four separate means:
// - no password is set, so password sign-in has nothing to match;
// - `ban_duration` bans them for a hundred years. Supabase Auth answers a
//   request that relates to a banned user with its `user_banned` error
//   ("No further API requests should be attempted until this field is
//   cleared", from Supabase's error reference, read 2026-11-04), so a
//   magic link, OTP or recovery request for one is refused;
// - their addresses are on `.test`, a domain reserved never to resolve, so
//   no email to one can be delivered;
// - `email_confirm: true` means Auth sends no confirmation email when the
//   user is created, and createUser sends no invitation.
// No managed auth timestamp is set or backdated: created_at on auth.users is
// the time of the run. The app's own dates (profiles.created_at and the
// rest) carry the generated history.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProductionTarget } from "./env";
import { readAll } from "../../src/lib/read-all";
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

export const BAN_DURATION = "876000h"; // one hundred years
const REQUEST_TIMEOUT_MS = 30_000;
const CHUNK = 100; // ids per filter, to keep request URLs short

function chunks<T>(xs: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function fail(what: string, error: { message: string } | null): asserts error is null {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** The attributes every sample user is created with. Exported for the test that pins them. */
export function sampleUserAttributes(u: { id: string; email: string; runId: string; n: number }) {
  return {
    id: u.id,
    email: u.email,
    email_confirm: true,
    ban_duration: BAN_DURATION,
    app_metadata: { sophecs_sample: true, seed_run: u.runId, n: u.n },
    user_metadata: {},
  };
}

const ORDER_KEY: Partial<Record<ScanTable, string[]>> = {
  class_members: ["class_id", "user_id"],
  blocks: ["blocker_id", "blocked_id"],
  debate_topics: ["slug"],
};

export class SupabaseAdapter implements Adapter {
  readonly target = "production" as const;
  private db: SupabaseClient;

  constructor(private t: ProductionTarget, client?: SupabaseClient) {
    this.db =
      client ??
      createClient(t.url, t.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        // No request may hang: a stalled call would hold the run's lock
        // without refreshing it. The engine retries a timed-out call.
        global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }) },
      });
  }

  describe() {
    return `production ${this.t.ref}`;
  }

  async checkSchema() {
    for (const table of ["profiles", "quiz_results", "challenges", "debates", "exchanges"]) {
      const { error } = await this.db.from(table).select("is_sample").limit(1);
      fail(`migration 0022 is not applied (${table}.is_sample)`, error);
    }
    const { error } = await this.db.from("seed_runs").select("id").limit(1);
    fail("migration 0022 is not applied (seed_runs)", error);
  }

  async scan(table: ScanTable, columns: string[], where?: { sample?: boolean }) {
    const order = ORDER_KEY[table] ?? ["id"];
    const res = await readAll<Record<string, unknown>>((from, to) => {
      let q = this.db.from(table).select(columns.join(","), { count: "exact" });
      if (where?.sample !== undefined) q = q.eq("is_sample", where.sample);
      for (const o of order) q = q.order(o);
      return q.range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null; count: number | null }>;
    });
    // readAll fails on any short page, so a scan is never silently partial:
    // teardown's search for genuine rows that point at sample rows relies on it.
    if (res.error !== null) throw new Error(`scan ${table}: ${res.error}`);
    return res.rows;
  }

  async count(table: ScanTable, where?: { sample?: boolean }) {
    let q = this.db.from(table).select("*", { count: "exact", head: true });
    if (where?.sample !== undefined) q = q.eq("is_sample", where.sample);
    const { count, error } = await q;
    fail(`count ${table}`, error);
    return count ?? 0;
  }

  async percentile(elo: number) {
    const { data, error } = await this.db.rpc("elo_percentile", { user_elo: elo });
    fail("elo_percentile", error);
    return data === null ? null : Number(data);
  }

  async getRun(id: string) {
    const { data, error } = await this.db.from("seed_runs").select("*").eq("id", id).maybeSingle();
    fail("seed_runs read", error);
    return (data as SeedRun | null) ?? null;
  }
  async listRuns() {
    const { data, error } = await this.db.from("seed_runs").select("*").order("created_at");
    fail("seed_runs list", error);
    return (data ?? []) as SeedRun[];
  }
  async insertRun(run: SeedRun) {
    const { error } = await this.db.from("seed_runs").insert(run);
    fail("seed_runs insert", error);
  }
  async updateRun(id: string, patch: Partial<SeedRun>) {
    const { error } = await this.db.from("seed_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    fail("seed_runs update", error);
  }
  async updateRunLocked(id: string, token: string, patch: Partial<SeedRun>) {
    const { data, error } = await this.db
      .from("seed_runs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("lock_token", token)
      .select("id");
    fail("seed_runs update", error);
    return (data ?? []).length === 1;
  }
  async acquireLock(id: string, token: string) {
    const { data, error } = await this.db
      .from("seed_runs")
      .update({ lock_token: token, locked_at: new Date().toISOString() })
      .eq("id", id)
      .is("lock_token", null)
      .select("id");
    fail("lock", error);
    return (data ?? []).length === 1;
  }
  async releaseLock(id: string, token: string) {
    const { error } = await this.db.from("seed_runs").update({ lock_token: null, locked_at: null }).eq("id", id).eq("lock_token", token);
    fail("unlock", error);
  }
  async refreshLock(id: string, token: string) {
    const { data, error } = await this.db
      .from("seed_runs")
      .update({ locked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("lock_token", token)
      .select("id");
    fail("refresh lock", error);
    return (data ?? []).length === 1;
  }
  async breakStaleLock(id: string, minutes: number) {
    const { data, error } = await this.db
      .from("seed_runs")
      .update({ lock_token: null, locked_at: null })
      .eq("id", id)
      .not("lock_token", "is", null)
      .lt("locked_at", new Date(Date.now() - minutes * 60_000).toISOString())
      .select("id");
    fail("break stale lock", error);
    return (data ?? []).length === 1;
  }
  async recordIntents(items: Omit<RegistryItem, "state">[]) {
    for (const c of chunks(items, 500)) {
      const { error } = await this.db.from("seed_run_items").upsert(c, { onConflict: "run_id,kind,logical_id", ignoreDuplicates: true });
      fail("seed_run_items intents", error);
    }
  }
  async setState(runId: string, kind: Kind, logicalIds: string[], state: ItemState) {
    for (const c of chunks(logicalIds)) {
      const { error } = await this.db
        .from("seed_run_items")
        .update({ state, updated_at: new Date().toISOString() })
        .eq("run_id", runId)
        .eq("kind", kind)
        .in("logical_id", c);
      fail("seed_run_items state", error);
    }
  }
  async items(runId: string, kind: Kind) {
    const res = await readAll<RegistryItem>((from, to) =>
      this.db
        .from("seed_run_items")
        .select("run_id,kind,logical_id,row_id,state", { count: "exact" })
        .eq("run_id", runId)
        .eq("kind", kind)
        .order("logical_id")
        .range(from, to) as unknown as PromiseLike<{ data: RegistryItem[] | null; error: { message: string } | null; count: number | null }>
    );
    if (res.error !== null) throw new Error(`seed_run_items read: ${res.error}`);
    return res.rows;
  }

  async createAuthUser(u: { id: string; email: string; runId: string; n: number }) {
    const { data, error } = await this.db.auth.admin.createUser(sampleUserAttributes(u));
    fail("auth createUser", error);
    if (data.user?.id !== u.id || data.user?.email !== u.email) throw new Error("auth createUser returned a different user");
    // Every user is checked for its ban as it is made. A response without
    // one throws, and the engine then reads the user back and stops if it
    // is not banned: fail closed, whatever the response shape.
    const banned = (data.user as { banned_until?: string | null }).banned_until;
    if (!banned || Date.parse(banned) <= Date.now()) throw new Error("auth createUser returned a user without a ban");
  }
  async getAuthUser(id: string) {
    const { data, error } = await this.db.auth.admin.getUserById(id);
    if (error) {
      if ((error as { status?: number }).status === 404 || /not found/i.test(error.message)) return null;
      throw new Error(`auth getUserById: ${error.message}`);
    }
    const user = data.user;
    if (!user) return null;
    const banned = (user as { banned_until?: string | null }).banned_until;
    return {
      id: user.id,
      email: user.email ?? "",
      runId: (user.app_metadata as { seed_run?: string } | undefined)?.seed_run ?? null,
      loginBlocked: Boolean(banned && Date.parse(banned) > Date.now()),
    };
  }
  async deleteAuthUser(id: string) {
    const { error } = await this.db.auth.admin.deleteUser(id);
    fail("auth deleteUser", error);
  }

  async insertIgnore(table: Table, rows: Record<string, unknown>[], conflict: string[]) {
    for (const c of chunks(rows, 250)) {
      const { error } = await this.db.from(table).upsert(c, { onConflict: conflict.join(","), ignoreDuplicates: true });
      fail(`${table} insert`, error);
    }
  }
  async selectByIds(table: Table, ids: string[]) {
    const out: Record<string, unknown>[] = [];
    if (table === "class_members") {
      const want = new Set(ids);
      const byClass = new Map<string, string[]>();
      for (const k of ids) {
        const [cid, uid] = k.split(":");
        byClass.set(cid, [...(byClass.get(cid) ?? []), uid]);
      }
      for (const [cid, uids] of byClass)
        for (const c of chunks(uids)) {
          const { data, error } = await this.db.from(table).select("*").eq("class_id", cid).in("user_id", c);
          fail(`${table} read`, error);
          out.push(...(data ?? []).filter((r) => want.has(`${r.class_id}:${r.user_id}`)));
        }
      return out;
    }
    for (const c of chunks(ids)) {
      const { data, error } = await this.db.from(table).select("*").in("id", c);
      fail(`${table} read`, error);
      out.push(...(data ?? []));
    }
    return out;
  }
  async updateSampleRows(table: "profiles", rows: { id: string; patch: Record<string, unknown> }[]) {
    // One request per row: each is scoped to is_sample, so a genuine id
    // passed by mistake matches nothing. Four at a time.
    let next = 0;
    const worker = async () => {
      while (next < rows.length) {
        const { id, patch } = rows[next++];
        const { error } = await this.db.from(table).update(patch).eq("id", id).eq("is_sample", true);
        fail(`${table} update`, error);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }
  async linkChallenge(id: string, a: string, b: string) {
    const { error } = await this.db
      .from("challenges")
      .update({ challenger_debate_id: a, challengee_debate_id: b })
      .eq("id", id)
      .eq("is_sample", true);
    fail("challenge link", error);
  }
  async unlinkChallenges(ids: string[]) {
    for (const c of chunks(ids)) {
      const { error } = await this.db
        .from("challenges")
        .update({ challenger_debate_id: null, challengee_debate_id: null })
        .in("id", c)
        .eq("is_sample", true);
      fail("challenge unlink", error);
    }
  }
  async clearSampleChallengeFrom(ids: string[]) {
    for (const c of chunks(ids)) {
      const { error } = await this.db.from("quiz_results").update({ challenge_from: null }).in("id", c).eq("is_sample", true);
      fail("quiz_results challenge_from", error);
    }
  }
  async deleteOwned(table: Table, ids: string[], ownerIds: string[]) {
    if (MARKED.has(table)) {
      for (const c of chunks(ids)) {
        const { error } = await this.db.from(table).delete().in("id", c).eq("is_sample", true);
        fail(`${table} delete`, error);
      }
      return;
    }
    // No marker: read the rows, keep those whose owner is one of the run's
    // own ids, and delete exactly those.
    const owners = new Set(ownerIds);
    const col = OWNER_COLUMN[table as keyof typeof OWNER_COLUMN];
    const owned = (await this.selectByIds(table, ids)).filter((r) => owners.has(String(r[col])));
    if (table === "class_members") {
      const byClass = new Map<string, string[]>();
      for (const r of owned) byClass.set(String(r.class_id), [...(byClass.get(String(r.class_id)) ?? []), String(r.user_id)]);
      for (const [cid, uids] of byClass)
        for (const c of chunks(uids)) {
          const { error } = await this.db.from(table).delete().eq("class_id", cid).in("user_id", c);
          fail(`${table} delete`, error);
        }
      return;
    }
    for (const c of chunks(owned.map((r) => String(r.id)))) {
      const { error } = await this.db.from(table).delete().in("id", c);
      fail(`${table} delete`, error);
    }
  }
  async clearReference(e: Entanglement) {
    let q = this.db.from(e.table).update({ [e.column]: null }).eq("id", e.rowId).eq(e.column, e.pointsAt);
    if (MARKED.has(e.table as Table)) q = q.eq("is_sample", false);
    const { error } = await q;
    fail(`${e.table}.${e.column} clear`, error);
  }
  async close() {}
}
