// The scheduled workflow's path (scripts/seed/ci.ts) against an in-memory
// database: canary, full, then extensions, each one appending; nothing
// before a full stage or after teardown; a wrong seed refused before a
// write; and a log with nothing in it that is secret or a reader's.
import { describe, expect, it } from "vitest";
import { MemoryAdapter } from "../../scripts/seed/adapter-memory";
import { runCi, CANARY_ACCOUNTS, HALTED, type Mode } from "../../scripts/seed/ci";
import { teardown } from "../../scripts/seed/teardown";
import { contentTopics } from "../../scripts/seed/topics";

const SEED = "ci-test-seed-0123456789abcdef";
const SMALL = { users: 160, anonResults: 150, challenges: 16, exchanges: 16, classes: 1 };
const T0 = Date.parse("2026-11-04T09:00:00.000Z");
const at = (hours: number) => new Date(T0 + hours * 3_600_000).toISOString();

function freshDb() {
  const db = new MemoryAdapter();
  for (const t of contentTopics())
    db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
  // A genuine reader, whose numbers must not reach the log.
  db.table("profiles").set("g1", { id: "g1", elo: 1234, streak: 7, school: "stoicism", is_sample: false });
  return db;
}

async function step(db: MemoryAdapter, mode: Mode, hours: number, seed = SEED) {
  const lines: string[] = [];
  const out = await runCi({ mode, adapter: db, seed, projectRef: "tekifezydjlgxgndkxul", now: () => at(hours), log: (l) => lines.push(l), config: SMALL, batchSize: 100 });
  return { out, lines };
}

const samples = (db: MemoryAdapter, table: string) => [...db.table(table).values()].filter((r) => r.is_sample).length;

describe("the scheduled workflow's path", () => {
  it("does nothing before a run exists, then canary, full and extensions each append", async () => {
    const db = freshDb();
    expect((await step(db, "extend", 0)).out.outcome).toBe("idle");

    const canary = await step(db, "canary", 0);
    expect(canary.out).toMatchObject({ ok: true, outcome: "written" });
    expect(samples(db, "profiles")).toBe(CANARY_ACCOUNTS);
    // The schedule waits for the full stage.
    expect((await step(db, "extend", 1)).out.outcome).toBe("idle");

    const full = await step(db, "full", 2);
    expect(full.out.ok).toBe(true);
    expect(samples(db, "profiles")).toBe(SMALL.users);
    const debatesAfterFull = samples(db, "debates");
    const run = (await db.listRuns())[0];
    expect(run.counts.stage).toBe("full");
    expect(Date.parse(run.window_to)).toBe(Date.parse(at(2)));

    const ext = await step(db, "extend", 24 * 7);
    expect(ext.out.ok).toBe(true);
    expect(samples(db, "profiles")).toBe(SMALL.users);
    expect(samples(db, "debates")).toBeGreaterThan(debatesAfterFull);
    expect(Date.parse((await db.listRuns())[0].window_to)).toBe(Date.parse(at(24 * 7)));
    // The full report is kept in the run's row, with the genuine figures.
    expect((await db.listRuns())[0].last_report).toMatchObject({ mode: "extend", ok: true });

    // A second canary is refused while the run exists.
    await expect(step(db, "canary", 24 * 8)).rejects.toThrow(/exists/);

    // After teardown, the schedule does nothing.
    await teardown(db, run.id);
    expect((await step(db, "extend", 24 * 9)).out.outcome).toBe("idle");
  });

  it("clears a lock a killed job left, so the next scheduled run resumes", async () => {
    const db = freshDb();
    await step(db, "canary", 0);
    await step(db, "full", 1);
    const run = (await db.listRuns())[0];
    // The runner was stopped mid-write three hours ago: its lock is still there.
    await db.updateRun(run.id, { lock_token: "dead-job", locked_at: new Date(Date.now() - 3 * 3_600_000).toISOString() });
    const ext = await step(db, "extend", 6);
    expect(ext.out).toMatchObject({ ok: true, outcome: "written" });
    expect(ext.lines.join("\n")).toContain("cleared a stale lock");
    expect((await db.getRun(run.id))!.lock_token).toBeNull();
  });

  it("does not clear a lock a live job may still hold", async () => {
    const db = freshDb();
    await step(db, "canary", 0);
    await step(db, "full", 1);
    const run = (await db.listRuns())[0];
    await db.updateRun(run.id, { lock_token: "live-job", locked_at: new Date(Date.now() - 60_000).toISOString() });
    await expect(step(db, "extend", 6)).rejects.toThrow(/less than 15 minutes old/);
  });

  it("halts the schedule after a failed validation, until a full stage passes", async () => {
    const db = freshDb();
    await step(db, "canary", 0);
    await step(db, "full", 1);
    const run = (await db.listRuns())[0];
    // Stored texts no longer match the plan (as after an edit to the passages).
    const debates = db.table("debates");
    const kept = new Map<string, unknown>();
    for (const [id, r] of debates) {
      if (!r.is_sample) continue;
      kept.set(id, r.argument);
      debates.set(id, { ...r, argument: "edited" });
    }
    const bad = await step(db, "extend", 24);
    expect(bad.out).toMatchObject({ ok: false, outcome: "written" });
    expect(bad.lines.join("\n")).toMatch(/^FAIL {2}spot check: debates$/m);
    expect((await db.getRun(run.id))!).toMatchObject({ status: "failed" });
    expect((await db.getRun(run.id))!.last_error).toMatch(new RegExp(`^${HALTED}`));

    const before = samples(db, "debates");
    const held = await step(db, "extend", 30);
    expect(held.out).toMatchObject({ ok: false, outcome: "halted" });
    expect(samples(db, "debates")).toBe(before);

    // Put right, a full stage run by hand clears the halt, and the schedule resumes.
    for (const [id, a] of kept) debates.set(id, { ...debates.get(id)!, argument: a });
    expect((await step(db, "full", 31)).out).toMatchObject({ ok: true });
    expect((await db.getRun(run.id))!.last_error).toBeNull();
    expect((await step(db, "extend", 36)).out).toMatchObject({ ok: true, outcome: "written" });
  });

  it("refuses another seed before writing anything", async () => {
    const db = freshDb();
    await step(db, "canary", 0);
    await step(db, "full", 1);
    const before = samples(db, "debates");
    const wrong = await step(db, "extend", 24 * 3, "another-seed-0123456789abcdef");
    expect(wrong.out).toMatchObject({ ok: false, outcome: "dry-run-failed" });
    expect(samples(db, "debates")).toBe(before);
  });

  it("logs no seed, no hash and no reader's figures", async () => {
    const db = freshDb();
    const lines = [
      ...(await step(db, "canary", 0)).lines,
      ...(await step(db, "full", 1)).lines,
      ...(await step(db, "extend", 24 * 2)).lines,
    ].join("\n");
    const run = (await db.listRuns())[0];
    expect(lines).not.toContain(SEED);
    expect(lines).not.toContain(run.plan_hash);
    expect(lines).not.toMatch(/[0-9a-f]{64}/);
    expect(lines).not.toContain("1234");
    // Check names may mention genuine rows; their figures never follow.
    expect(lines).not.toMatch(/genuine rows: |genuine profiles: |elo_percentile\(1200\) = |profiles \d+ -> \d+/);
    // The checks are named, without their figures.
    expect(lines).toMatch(/^ok {2}\s*elo_percentile\(1200\) counts genuine profiles only$/m);
    expect(lines).toMatch(/^ok {4}exact duplicate argument texts under 5%$/m);
  });

  it("tears down only with the run's id typed in, and logs counts only", async () => {
    const db = freshDb();
    await step(db, "canary", 0);
    await step(db, "full", 1);
    const run = (await db.listRuns())[0];
    // A genuine result pointing at a sample result: cleared, and its id kept out of the log.
    const sampleResult = [...db.table("quiz_results").values()].find((r) => r.is_sample)!;
    db.table("quiz_results").set("GENUINE01", { id: "GENUINE01", user_id: "g1", challenge_from: sampleResult.id, is_sample: false });
    const lines: string[] = [];
    const run1 = (confirm?: string) =>
      runCi({ mode: "teardown", adapter: db, seed: "", projectRef: "tekifezydjlgxgndkxul", now: () => at(2), log: (l) => lines.push(l), config: SMALL, confirmTeardown: confirm });
    await expect(run1(undefined)).rejects.toThrow(/repeat the run id/);
    await expect(run1("sample-wrong")).rejects.toThrow(/repeat the run id/);
    expect(samples(db, "debates")).toBeGreaterThan(0);
    const out = await run1(run.id);
    expect(out).toMatchObject({ ok: true, outcome: "torn-down" });
    expect(samples(db, "profiles") + samples(db, "debates") + samples(db, "quiz_results")).toBe(0);
    expect(db.table("quiz_results").get("GENUINE01")).toMatchObject({ challenge_from: null, is_sample: false });
    expect(lines.join("\n")).not.toContain("GENUINE01");
    expect(lines.join("\n")).not.toContain("g1");
    expect((await db.getRun(run.id))!.status).toBe("torn_down");
  });
});

