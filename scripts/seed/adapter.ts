// What the engine needs from a database, and nothing else. Three
// implementations: adapter-local.ts (psql against a Postgres on this
// machine), adapter-supabase.ts (the Data API and the Auth admin API, for
// production) and adapter-memory.ts (tests).
//
// Every delete and update an adapter offers is scoped by ownership as well
// as by id: a sample marker, or the run's own users. A bug that passed a
// genuine id would match nothing.

export type Kind =
  | "auth_user"
  | "profile"
  | "quiz_result"
  | "challenge"
  | "debate"
  | "exchange"
  | "turn"
  | "reading_response"
  | "class"
  | "class_member";

// abandoned: an intent whose id turned out to belong to a row the run did
// not write (the collision the engine stops on). Never acted on; kept, and
// reported, so the audit says what happened.
export type ItemState = "intended" | "created" | "deleted" | "abandoned";

export interface RegistryItem {
  run_id: string;
  kind: Kind;
  logical_id: string;
  row_id: string;
  state: ItemState;
}

export type RunStatus = "running" | "complete" | "failed" | "tearing_down" | "torn_down";

export interface SeedRun {
  id: string;
  status: RunStatus;
  /** The base hash (plan.ts): generator, seed, base window, config, motions. The seed itself is never stored. */
  plan_hash: string;
  generator_version: string;
  window_from: string;
  /** The base window's end, fixed for the life of the run. */
  base_to: string;
  /** How far the run's activity reaches; moves forward with each extension. */
  window_to: string;
  counts: Record<string, unknown>;
  /** The last execution's or validation's full report, kept here rather than in public logs. */
  last_report: Record<string, unknown> | null;
  lock_token: string | null;
  locked_at: string | null;
  last_error: string | null;
}

/** Tables the engine writes, with how a row's ownership is proven. */
export type Table =
  | "profiles"
  | "quiz_results"
  | "challenges"
  | "debates"
  | "exchanges"
  | "turns"
  | "reading_responses"
  | "classes"
  | "class_members";

export const MARKED: ReadonlySet<Table> = new Set(["profiles", "quiz_results", "challenges", "debates", "exchanges"]);

/**
 * How a row in each unmarked table is tied to the run: the column that
 * must hold one of the run's own ids.
 */
export const OWNER_COLUMN: Record<Exclude<Table, "profiles" | "quiz_results" | "challenges" | "debates" | "exchanges">, string> = {
  turns: "exchange_id",
  reading_responses: "user_id",
  classes: "owner_id",
  class_members: "user_id",
};

/** A genuine row that points at a sample row. Teardown must not orphan it. */
export interface Entanglement {
  table: string;
  column: string;
  rowId: string;
  pointsAt: string;
  /** Nullable references are cleared before the sample row goes; anything else stops teardown. */
  nullable: boolean;
}

/** Tables and views a scan may read. Read-only. */
export type ScanTable =
  | Table
  | "debate_topics"
  | "blocks"
  | "reports"
  | "ai_calls";

export interface Adapter {
  readonly target: "local" | "production" | "memory";
  describe(): string;

  // Read-only.
  /** Throws unless migration 0022 is in place. */
  checkSchema(): Promise<void>;
  /** Every row of a table, paginated by the adapter, optionally only genuine or only sample rows. */
  scan(table: ScanTable, columns: string[], where?: { sample?: boolean }): Promise<Record<string, unknown>[]>;
  /** `eloBelow` counts profiles whose rating is under it (profiles only). */
  count(table: ScanTable, where?: { sample?: boolean; eloBelow?: number }): Promise<number>;
  /**
   * The ratings /api/judge averages into a topic's par: elo_before of the
   * topic's genuine originals, newest first, at most `n`. Numbers only, so
   * no reader's row leaves the database to check the par.
   */
  parWindow(topic: string, n: number): Promise<number[]>;
  /** public.elo_percentile(elo). */
  percentile(elo: number): Promise<number | null>;

  // The registry.
  getRun(id: string): Promise<SeedRun | null>;
  listRuns(): Promise<SeedRun[]>;
  insertRun(run: SeedRun): Promise<void>;
  updateRun(id: string, patch: Partial<SeedRun>): Promise<void>;
  /** As updateRun, only while `token` holds the run's lock. False when it does not. */
  updateRunLocked(id: string, token: string, patch: Partial<SeedRun>): Promise<boolean>;
  /** Takes the run's lock if nobody holds it. True when taken. */
  acquireLock(id: string, token: string): Promise<boolean>;
  releaseLock(id: string, token: string): Promise<void>;
  /** Moves locked_at to now while `token` still holds the lock. False when it does not. */
  refreshLock(id: string, token: string): Promise<boolean>;
  /**
   * Clears a lock left by a process that died, only if it was taken more
   * than `minutes` ago. True when a lock was cleared.
   */
  breakStaleLock(id: string, minutes: number): Promise<boolean>;
  /** Inserts intents; an existing (run, kind, logical id) is left alone, and a row another run owns is refused. */
  recordIntents(items: Omit<RegistryItem, "state">[]): Promise<void>;
  setState(runId: string, kind: Kind, logicalIds: string[], state: ItemState): Promise<void>;
  items(runId: string, kind: Kind): Promise<RegistryItem[]>;

  // Auth users.
  createAuthUser(u: { id: string; email: string; runId: string; n: number }): Promise<void>;
  /** Null when absent. `runId` is what the user's own metadata says. */
  getAuthUser(id: string): Promise<{ id: string; email: string; runId: string | null; loginBlocked: boolean } | null>;
  deleteAuthUser(id: string): Promise<void>;

  // Rows. Every write is scoped by ownership as well as id.
  insertIgnore(table: Table, rows: Record<string, unknown>[], conflict: string[]): Promise<void>;
  /** Rows with these ids (or, for class_members, these "class:user" keys). */
  selectByIds(table: Table, ids: string[]): Promise<Record<string, unknown>[]>;
  /** Updates sample rows by id, only where is_sample is true. */
  updateSampleRows(table: "profiles", rows: { id: string; patch: Record<string, unknown> }[]): Promise<void>;
  /** Sets a sample challenge's two debate ids. */
  linkChallenge(id: string, challengerDebateId: string, challengeeDebateId: string): Promise<void>;
  /** Clears the debate ids on sample challenges, so their debates can go. */
  unlinkChallenges(ids: string[]): Promise<void>;
  /** Clears challenge_from on sample quiz results, so they can go in any order. */
  clearSampleChallengeFrom(ids: string[]): Promise<void>;
  /**
   * Deletes rows by id, and only rows that are marked (marked tables) or
   * whose owner column holds one of `ownerIds` (the rest).
   */
  deleteOwned(table: Table, ids: string[], ownerIds: string[]): Promise<void>;
  /** Sets a genuine row's reference to null, only while it still points at `pointsAt`. */
  clearReference(e: Entanglement): Promise<void>;
  close(): Promise<void>;
}
