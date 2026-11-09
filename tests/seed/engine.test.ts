// The engine and teardown against an in-memory database with the real
// schema's ownership rules: retries, lost responses, crashes, resumes,
// locks, refusal to adopt rows it did not write, and teardown that leaves
// genuine rows and other runs alone.
import { describe, expect, it, vi } from "vitest";
import { MemoryAdapter } from "../../scripts/seed/adapter-memory";
import { execute, finishValidation, HALTED, HaltedError, releaseHeld, StopError, VALIDATING } from "../../scripts/seed/engine";
import { validate } from "../../scripts/seed/validate";
import { preview, teardown } from "../../scripts/seed/teardown";
import { smallPlan } from "./fixture";
import type { Dataset } from "../../scripts/seed/generate";
import type { Plan } from "../../scripts/seed/plan";

const { plan, dataset } = smallPlan();
const quiet = { retryBaseMs: 1, batchSize: 100 };

function freshDb(faults = {}) {
  const db = new MemoryAdapter(faults);
  for (const t of plan.topics)
    db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
  // A genuine reader, with a debate and a result, that nothing may touch.
  db.table("profiles").set("g1", { id: "g1", elo: 1216, streak: 1, school: "stoicism", is_sample: false });
  db.table("quiz_results").set("GEN0000001", { id: "GEN0000001", user_id: "g1", challenge_from: null, is_sample: false });
  db.table("debates").set("GEN000DEB1", { id: "GEN000DEB1", user_id: "g1", challenge_id: null, parent_debate_id: null, is_sample: false, seeking_counterpart_at: null });
  return db;
}

const genuine = (db: MemoryAdapter) =>
  JSON.stringify(["profiles", "quiz_results", "debates"].map((t) => [...db.table(t).values()].filter((r) => !r.is_sample)));

const sampleRows = (db: MemoryAdapter) =>
  ["profiles", "quiz_results", "challenges", "debates", "exchanges"].reduce((n, t) => n + [...db.table(t).values()].filter((r) => r.is_sample).length, 0) +
  ["turns", "reading_responses", "classes", "class_members"].reduce((n, t) => n + db.table(t).size, 0);

const total = (ds: Dataset) =>
  ds.profiles.length + ds.quizResults.length + ds.challenges.length + ds.debates.length + ds.exchanges.length + ds.turns.length + ds.readingResponses.length + ds.classes.length + ds.classMembers.length;

describe("execute", () => {
  it("writes every row once, validates, and changes no genuine row", async () => {
    const db = freshDb();
    const before = genuine(db);
    const r = await execute({ dataset, plan, adapter: db, ...quiet });
    expect(sampleRows(db)).toBe(total(dataset));
    expect(db.authUsers.size).toBe(dataset.authUsers.length);
    expect(genuine(db)).toBe(before);
    const v = await validate(db, dataset, r.before);
    expect(v.checks.filter((c) => !c.ok)).toEqual([]);
    expect((await db.getRun(plan.runId))!.status).toBe("complete");
  });

  it("is a no-op the second time", async () => {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet });
    const again = await execute({ dataset, plan, adapter: db, ...quiet });
    expect(Object.values(again.written).reduce((a, b) => a + b, 0)).toBe(0);
    expect(sampleRows(db)).toBe(total(dataset));
  });

  it("survives writes that succeed and then report failure, without duplicates", async () => {
    const db = freshDb({ failAfter: { "insert:debates": 2, createAuthUser: 3, recordIntents: 1 } });
    await execute({ dataset, plan, adapter: db, ...quiet });
    expect(db.authUsers.size).toBe(dataset.authUsers.length);
    expect(sampleRows(db)).toBe(total(dataset));
  });

  it("resumes a crashed run where it stopped, writing nothing twice", async () => {
    const db = freshDb({ failBefore: { "insert:debates": 3 } });
    await expect(execute({ dataset, plan, adapter: db, ...quiet, retries: 3 })).rejects.toThrow(/injected/);
    const run = (await db.getRun(plan.runId))!;
    expect(run.status).toBe("failed");
    expect(run.lock_token).toBeNull();
    const profilesBefore = db.calls["insert:profiles"];
    await execute({ dataset, plan, adapter: db, ...quiet });
    expect(db.calls["insert:profiles"]).toBe(profilesBefore); // profiles were already created
    expect(sampleRows(db)).toBe(total(dataset));
    expect((await db.getRun(plan.runId))!.status).toBe("complete");
  });

  it("refuses to adopt a genuine row that happens to have a planned id", async () => {
    const db = freshDb();
    const victim = dataset.debates[5].rowId;
    db.table("debates").set(victim, { id: victim, user_id: "g1", is_sample: false, argument: "genuine" });
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(StopError);
    expect(db.table("debates").get(victim)).toMatchObject({ is_sample: false, argument: "genuine" });
  });

  it("refuses to adopt an auth user that is not the run's", async () => {
    const db = freshDb();
    const u = dataset.authUsers[3];
    db.authUsers.set(u.rowId, { id: u.rowId, email: "someone@example.com", runId: null, loginBlocked: false });
    // An earlier attempt's intent makes the engine look before creating.
    await db.insertRun({ id: plan.runId, status: "failed", plan_hash: plan.baseHash, generator_version: plan.generatorVersion, window_from: plan.window.from, base_to: plan.window.baseTo, window_to: plan.window.to, counts: {}, last_report: null, lock_token: null, locked_at: null, last_error: null });
    await db.recordIntents([{ run_id: plan.runId, kind: "auth_user", logical_id: u.logicalId, row_id: u.rowId }]);
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/not this run's/);
  });

  it("runs one run at a time, and resumes only from its own plan", async () => {
    const db = freshDb();
    await db.insertRun({ id: "sample-1-other", status: "running", plan_hash: "x", generator_version: "x", window_from: plan.window.from, base_to: plan.window.baseTo, window_to: plan.window.to, counts: {}, last_report: null, lock_token: "held", locked_at: new Date().toISOString(), last_error: null });
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/holds a lock/);
    const db2 = freshDb();
    await db2.insertRun({ id: plan.runId, status: "failed", plan_hash: "another", generator_version: plan.generatorVersion, window_from: plan.window.from, base_to: plan.window.baseTo, window_to: plan.window.to, counts: {}, last_report: null, lock_token: null, locked_at: null, last_error: null });
    await expect(execute({ dataset, plan, adapter: db2, ...quiet })).rejects.toThrow(/different plan/);
  });

  it("clears a dead process's lock only when asked and only once it is stale", async () => {
    const db = freshDb();
    const run = { id: plan.runId, status: "running" as const, plan_hash: plan.baseHash, generator_version: plan.generatorVersion, window_from: plan.window.from, base_to: plan.window.baseTo, window_to: plan.window.to, counts: {}, last_report: null, lock_token: "dead", locked_at: new Date().toISOString(), last_error: null };
    await db.insertRun(run);
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/locked by another process/);
    await expect(execute({ dataset, plan, adapter: db, ...quiet, breakStaleLock: true })).rejects.toThrow(/less than 15 minutes/);
    await db.updateRun(plan.runId, { locked_at: new Date(Date.now() - 20 * 60_000).toISOString() });
    await execute({ dataset, plan, adapter: db, ...quiet, breakStaleLock: true });
    expect(sampleRows(db)).toBe(total(dataset));
  });

  it("writes only the canary's cohort, then the rest", async () => {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 25 });
    expect(db.authUsers.size).toBe(25);
    const inCanary = dataset.debates.filter((d) => d.cohort < 25).length;
    expect([...db.table("debates").values()].filter((d) => d.is_sample).length).toBe(inCanary);
    expect((await db.getRun(plan.runId))!.status).toBe("running");
    const v = await validate(db, dataset, null, { cohortLimit: 25 });
    expect(v.checks.filter((c) => !c.ok)).toEqual([]);
    await execute({ dataset, plan, adapter: db, ...quiet });
    expect(sampleRows(db)).toBe(total(dataset));
  });

  it("refuses a canary on a run that has had its full stage, or is halted, since it checks only its first cohorts", async () => {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 30 });
    await db.updateRun(plan.runId, { status: "failed", last_error: `${HALTED}: spot check: debates` });
    // A smaller canary on a halted canary-stage run.
    await expect(execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 5, endHalted: VALIDATING })).rejects.toThrow(/is halted after a canary of 30; a smaller canary cannot be run on it/);
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: `${HALTED}: spot check: debates`, lock_token: null });
    // The same canary again is a resume: it validates all it wrote, and
    // keeps the halt until that passes.
    const again = await execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 30, endHalted: VALIDATING });
    expect(again.heldWith).toBe(`${HALTED}: spot check: debates`);
    expect(await finishValidation(db, again, [])).toBe(true);
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "running", last_error: null, lock_token: null });
    // Once the full stage has passed, no canary at all.
    await db.updateRun(plan.runId, { status: "running", last_error: null });
    await execute({ dataset, plan, adapter: db, ...quiet });
    await expect(execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 25 })).rejects.toThrow(/has had its full stage; a canary cannot be run on it/);
    expect((await db.getRun(plan.runId))!.lock_token).toBeNull();
  });

  it("keeps the run locked from the end of its writes until the validation is recorded", async () => {
    const db = freshDb();
    const r = await execute({ dataset, plan, adapter: db, ...quiet, endHalted: VALIDATING });
    expect(r.heldWith).toBe(VALIDATING);
    expect(r.lockToken).toBeTruthy();
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: VALIDATING, lock_token: r.lockToken });
    // Another writer, or a teardown, is refused while it is validated.
    await expect(execute({ dataset, plan, adapter: db, ...quiet, endHalted: VALIDATING })).rejects.toThrow(/locked by another process/);
    await expect(teardown(db, plan.runId)).rejects.toThrow(/lock/);
    // The result is recorded under that lock, which is then released.
    expect(await finishValidation(db, r, ["spot check: debates"])).toBe(true);
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: `${HALTED}: spot check: debates`, lock_token: null });
  });

  it("decides from the run as it is once the lock is held, and releases the lock on a refusal", async () => {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet });
    // Halted by another process between this run's checks and its lock.
    const acquire = db.acquireLock.bind(db);
    const spy = vi.spyOn(db, "acquireLock").mockImplementation(async (...args: Parameters<MemoryAdapter["acquireLock"]>) => {
      await db.updateRun(plan.runId, { status: "failed", last_error: `${HALTED}: spot check: debates` });
      return acquire(...args);
    });
    await expect(execute({ dataset, plan, adapter: db, ...quiet, refuseHalted: true, endHalted: VALIDATING })).rejects.toBeInstanceOf(HaltedError);
    spy.mockRestore();
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: `${HALTED}: spot check: debates`, lock_token: null });
  });

  it("releases the lock when a read fails between taking it and writing", async () => {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet, cohortLimit: 25 });
    const getRun = db.getRun.bind(db);
    let armed = false;
    const acquire = db.acquireLock.bind(db);
    const a = vi.spyOn(db, "acquireLock").mockImplementation(async (...args: Parameters<MemoryAdapter["acquireLock"]>) => {
      const ok = await acquire(...args);
      armed = true;
      return ok;
    });
    const g = vi.spyOn(db, "getRun").mockImplementation(async (...args: Parameters<MemoryAdapter["getRun"]>) => {
      if (armed) {
        armed = false;
        throw new Error("read timed out");
      }
      return getRun(...args);
    });
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/read timed out/);
    a.mockRestore();
    g.mockRestore();
    expect((await db.getRun(plan.runId))!.lock_token).toBeNull();
  });

  it("keeps the halt, and releases the lock, when the end's refresh of the lock fails", async () => {
    const db = freshDb();
    const spy = vi.spyOn(db, "refreshLock");
    let calls = 0;
    const refresh = MemoryAdapter.prototype.refreshLock.bind(db);
    spy.mockImplementation(async (...args: Parameters<MemoryAdapter["refreshLock"]>) => {
      calls++;
      // Every heartbeat succeeds; the refresh at the end does not.
      if ((await db.getRun(plan.runId))!.last_error === VALIDATING) throw new Error("fetch failed");
      return refresh(...args);
    });
    const r = await execute({ dataset, plan, adapter: db, ...quiet, endHalted: VALIDATING });
    spy.mockRestore();
    expect(calls).toBeGreaterThan(0);
    expect(r.lockToken).toBeNull();
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: VALIDATING, lock_token: null });
    expect(await finishValidation(db, r, [])).toBe(false);
    await releaseHeld(db, r);
  });

  it("records nothing when the kept lock was taken, and leaves the halt", async () => {
    const db = freshDb();
    const r = await execute({ dataset, plan, adapter: db, ...quiet, endHalted: VALIDATING });
    // Broken as stale and taken by another process.
    await db.updateRun(plan.runId, { lock_token: "other", locked_at: new Date().toISOString() });
    expect(await finishValidation(db, r, [])).toBe(false);
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "failed", last_error: VALIDATING, lock_token: "other" });
  });

  it("without endHalted, releases its lock and keeps none", async () => {
    const db = freshDb();
    const r = await execute({ dataset, plan, adapter: db, ...quiet });
    expect(r.lockToken).toBeNull();
    expect((await db.getRun(plan.runId))!).toMatchObject({ status: "complete", lock_token: null });
  });

  it("stops cleanly when cancelled and resumes", async () => {
    const db = freshDb();
    const ac = new AbortController();
    ac.abort();
    const r = await execute({ dataset, plan, adapter: db, ...quiet, signal: ac.signal });
    expect(r.cancelled).toBe(true);
    expect((await db.getRun(plan.runId))!.lock_token).toBeNull();
    await execute({ dataset, plan, adapter: db, ...quiet });
    expect(sampleRows(db)).toBe(total(dataset));
  });

  it("refuses when the target's motions differ from the plan's", async () => {
    const db = freshDb();
    db.table("debate_topics").get("no-decision")!.motion = "Reworded.";
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/differs from the plan/);
    expect(db.authUsers.size).toBe(0);
  });
});

describe("teardown", () => {
  async function seeded(other?: { plan: Plan; dataset: Dataset }) {
    const db = freshDb();
    await execute({ dataset, plan, adapter: db, ...quiet });
    if (other) await execute({ dataset: other.dataset, plan: other.plan, adapter: db, ...quiet });
    return db;
  }

  it("removes exactly the run's rows, clears genuine references first, and keeps the audit", async () => {
    const db = await seeded();
    const sampleResult = dataset.quizResults[0].rowId;
    const sampleChallenge = dataset.challenges[0].rowId;
    db.table("quiz_results").set("GEN0000002", { id: "GEN0000002", user_id: "g1", challenge_from: sampleResult, is_sample: false });
    db.table("debates").set("GEN000DEB2", { id: "GEN000DEB2", user_id: "g1", challenge_id: sampleChallenge, parent_debate_id: null, is_sample: false });
    const p = await preview(db, plan.runId);
    expect(p.entanglements.map((e) => `${e.table}.${e.column}`).sort()).toEqual(["debates.challenge_id", "quiz_results.challenge_from"]);
    expect(p.blocking).toEqual([]);
    await teardown(db, plan.runId);
    expect(sampleRows(db)).toBe(0);
    expect(db.authUsers.size).toBe(0);
    expect(db.table("quiz_results").get("GEN0000002")).toMatchObject({ challenge_from: null, is_sample: false });
    expect(db.table("debates").get("GEN000DEB2")).toMatchObject({ challenge_id: null, is_sample: false });
    expect(db.table("profiles").get("g1")).toMatchObject({ elo: 1216, is_sample: false });
    expect((await db.getRun(plan.runId))!.status).toBe("torn_down");
    expect([...db.registry.values()].every((i) => i.state === "deleted")).toBe(true);
  });

  // A sample account's reply (src/lib/sample-reply.ts) logs a reader's
  // AI calls naming the sample's argument; they stay, as spend that
  // happened, and stop naming it. The reader's exchange with the sample
  // cannot be kept without the argument, so it stops the teardown.
  it("keeps a reader's AI calls on a sample's argument, and stops for a reader's exchange with a sample", async () => {
    const db = await seeded();
    const sampleDebate = dataset.debates[0].rowId;
    const sampleUser = dataset.debates[0].row.user_id;
    db.table("ai_calls").set("CALL000001", { id: "CALL000001", user_id: "g1", kind: "sample_reply", debate_id: sampleDebate });
    db.table("ai_calls").set("CALL000002", { id: "CALL000002", user_id: "g1", kind: "screen", debate_id: sampleDebate });
    const p = await preview(db, plan.runId);
    expect(p.entanglements.filter((e) => e.table === "ai_calls").map((e) => `${e.column}:${e.nullable}`)).toEqual(["debate_id:true", "debate_id:true"]);
    expect(p.blocking).toEqual([]);
    db.table("exchanges").set("GENEXCH001", { id: "GENEXCH001", debate_a: "GEN000DEB9", debate_b: sampleDebate, user_a: "g1", user_b: sampleUser, is_sample: false });
    const rowsBefore = sampleRows(db);
    await expect(teardown(db, plan.runId)).rejects.toThrow(/genuine row/);
    expect(sampleRows(db)).toBe(rowsBefore);
    db.table("exchanges").delete("GENEXCH001");
    await teardown(db, plan.runId);
    expect(sampleRows(db)).toBe(0);
    expect(db.table("ai_calls").get("CALL000001")).toMatchObject({ debate_id: null, kind: "sample_reply", user_id: "g1" });
    expect(db.table("ai_calls").get("CALL000002")).toMatchObject({ debate_id: null, kind: "screen" });
  });

  it("stops, deleting nothing, when a genuine row could only be kept by deleting it", async () => {
    const db = await seeded();
    const cls = dataset.classes[0].rowId;
    db.table("class_members").set(`${cls}:g1`, { class_id: cls, user_id: "g1" });
    const rowsBefore = sampleRows(db);
    await expect(teardown(db, plan.runId)).rejects.toThrow(/genuine row/);
    expect(sampleRows(db)).toBe(rowsBefore);
    expect(db.table("class_members").has(`${cls}:g1`)).toBe(true);
  });

  it("leaves another run's rows alone", async () => {
    const other = smallPlan({ seed: "99", baseTo: "2026-11-04T11:00:00.000Z", to: "2026-11-04T11:00:00.000Z" });
    const db = await seeded(other);
    await teardown(db, plan.runId);
    expect(sampleRows(db)).toBe(total(other.dataset));
    const v = await validate(db, other.dataset, null);
    expect(v.checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("deletes by marker or owner as well as id: a genuine id passed by mistake survives", async () => {
    const db = await seeded();
    await db.deleteOwned("debates", ["GEN000DEB1"], []);
    await db.deleteOwned("reading_responses", [dataset.readingResponses[0].rowId], ["someone-else"]);
    expect(db.table("debates").has("GEN000DEB1")).toBe(true);
    expect(db.table("reading_responses").has(dataset.readingResponses[0].rowId)).toBe(true);
  });

  it("resumes after a teardown that died part way", async () => {
    const db = await seeded();
    // As if the process died after deleting half the auth users.
    const half = dataset.authUsers.slice(0, Math.floor(dataset.authUsers.length / 2));
    await teardown(db, plan.runId).catch(() => {});
    for (const u of half) db.authUsers.set(u.rowId, { id: u.rowId, email: u.row.email, runId: plan.runId, loginBlocked: true });
    await db.updateRun(plan.runId, { status: "tearing_down" });
    for (const i of db.registry.values()) if (i.kind === "auth_user" && half.some((u) => u.rowId === i.row_id)) i.state = "created";
    await teardown(db, plan.runId);
    expect(db.authUsers.size).toBe(0);
    expect((await db.getRun(plan.runId))!.counts).toMatchObject({ deleted: { auth_user: dataset.authUsers.length } });
  });
});

describe("the lock while a run is alive", () => {
  it("stops writing the moment another process takes the lock", async () => {
    const db = freshDb();
    let batches = 0;
    const realRefresh = db.refreshLock.bind(db);
    db.refreshLock = async (id: string, token: string) => {
      batches++;
      // After a few batches, someone breaks the lock and takes it.
      if (batches === 4) {
        db.runs.get(id)!.lock_token = "someone-else";
        return false;
      }
      return realRefresh(id, token);
    };
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/taken by another process/);
    const written = sampleRows(db);
    expect(written).toBeLessThan(total(dataset));
    // And it did not release the other process's lock, or mark its run
    // failed, on the way out.
    expect(db.runs.get(plan.runId)!.lock_token).toBe("someone-else");
    expect(db.runs.get(plan.runId)!.status).toBe("running");
  });

  it("refreshes the lock on every batch, so a live run never looks stale", async () => {
    const db = freshDb();
    const stamps: string[] = [];
    const realRefresh = db.refreshLock.bind(db);
    db.refreshLock = async (id: string, token: string) => {
      const ok = await realRefresh(id, token);
      stamps.push(db.runs.get(id)!.locked_at!);
      return ok;
    };
    await execute({ dataset, plan, adapter: db, ...quiet });
    expect(stamps.length).toBeGreaterThan(10);
  });
});

describe("genuine-state checks on a live site", () => {
  it("read counts and par windows only: a snapshot holds no reader's id or row", async () => {
    const { snapshot } = await import("../../scripts/seed/baseline");
    const db = freshDb();
    db.table("debates").set("GEN000DEB8", { id: "GEN000DEB8", user_id: "g1", topic_slug: "no-decision", kind: "original", elo_before: 1216, created_at: new Date().toISOString(), is_sample: false });
    const s = await snapshot(db);
    const text = JSON.stringify(s);
    for (const id of ["g1", "GEN000DEB8"]) expect(text).not.toContain(id);
    expect(s.expectedPar["no-decision"]).toEqual({ par: 1216, n: 1 });
  });

  it("pass through ordinary reader activity, and fail when the par is not the genuine par", async () => {
    const { snapshot, compareBaselines } = await import("../../scripts/seed/baseline");
    const db = freshDb();
    const before = await snapshot(db);
    await new Promise((r) => setTimeout(r, 5));
    // During the run: a reader argues (rating and par move through
    // /api/judge as normal), another signs up, and one deletes their account.
    db.table("debates").set("GEN000DEB9", { id: "GEN000DEB9", user_id: "g1", topic_slug: "no-decision", kind: "original", elo_before: 1216, created_at: new Date().toISOString(), is_sample: false });
    db.table("profiles").get("g1")!.elo = 1230;
    db.table("debate_topics").get("no-decision")!.par_elo = 1216;
    db.table("debate_topics").get("no-decision")!.par_n = 1;
    db.table("profiles").set("g3", { id: "g3", elo: 1200, streak: 0, school: "stoicism", is_sample: false });
    const after = await snapshot(db);
    expect(compareBaselines(before, after).filter((c) => !c.ok)).toEqual([]);
    db.table("profiles").delete("g3");
    expect(compareBaselines(before, await snapshot(db)).filter((c) => !c.ok)).toEqual([]);
    // A par that is not what genuine originals give fails, as does a par
    // moved on a topic with no genuine originals.
    db.table("debate_topics").get("no-decision")!.par_elo = 1250;
    db.table("debate_topics").get("crash-arithmetic")!.par_elo = 1300;
    const failed = compareBaselines(before, await snapshot(db)).filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(["debate_topics crash-arithmetic par is the genuine par", "debate_topics no-decision par is the genuine par"]);
  });
});

describe("review pass 2 scenarios", () => {
  const openStates = (db: MemoryAdapter) => [...db.registry.values()].filter((i) => i.state === "intended" || i.state === "created").length;

  it("after a failed run, teardown leaves no open intent, so the rollback can run", async () => {
    const db = freshDb({ failBefore: { "insert:debates": 3 } });
    await expect(execute({ dataset, plan, adapter: db, ...quiet, retries: 3 })).rejects.toThrow(/injected/);
    expect([...db.registry.values()].some((i) => i.kind === "debate" && i.state === "intended")).toBe(true);
    await teardown(db, plan.runId);
    expect(openStates(db)).toBe(0);
    expect((await db.getRun(plan.runId))!.status).toBe("torn_down");
  });

  it("an intent on a row the run did not write is abandoned and the row left alone", async () => {
    const db = freshDb();
    const victim = dataset.debates[5].rowId;
    db.table("debates").set(victim, { id: victim, user_id: "g1", is_sample: false, argument: "genuine" });
    db.table("quiz_results").set("GEN0000003", { id: "GEN0000003", user_id: "g1", challenge_from: null, is_sample: false });
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(StopError);
    const p = await preview(db, plan.runId);
    expect(p.foreign).toEqual([{ kind: "debate", rowId: victim }]);
    await teardown(db, plan.runId);
    expect(db.table("debates").get(victim)).toMatchObject({ is_sample: false, argument: "genuine" });
    expect([...db.registry.values()].find((i) => i.row_id === victim)!.state).toBe("abandoned");
    expect(openStates(db)).toBe(0);
  });

  it("auth workers start no new user after the first failure", async () => {
    const db = freshDb();
    const bad = dataset.authUsers[6].rowId;
    const real = db.createAuthUser.bind(db);
    let after = 0;
    let failed = false;
    db.createAuthUser = async (u) => {
      if (failed) after++;
      if (u.id === bad) {
        failed = true;
        throw new Error("refused");
      }
      return real(u);
    };
    await expect(execute({ dataset, plan, adapter: db, ...quiet, retries: 1, authConcurrency: 4 })).rejects.toThrow(/refused/);
    const created = db.authUsers.size;
    await new Promise((r) => setTimeout(r, 20));
    expect(db.authUsers.size).toBe(created);
    expect(after).toBeLessThanOrEqual(3); // at most the calls already in flight
  });

  it("a lock lost between writing a batch and marking it stops before the mark", async () => {
    const db = freshDb();
    let refreshes = 0;
    const realRefresh = db.refreshLock.bind(db);
    db.refreshLock = async (id: string, token: string) => {
      refreshes++;
      // The second refresh of a batch is the one before setState.
      if (refreshes === 6) {
        db.runs.get(id)!.lock_token = "someone-else";
        return false;
      }
      return realRefresh(id, token);
    };
    const marksBefore = () => [...db.registry.values()].filter((i) => i.state === "created").length;
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(/taken by another process/);
    const marked = marksBefore();
    // Batches are 100 here: two whole batches marked, the third written and not marked.
    expect(marked).toBe(200);
    expect(db.runs.get(plan.runId)!.status).toBe("running");
  });
});

describe("review pass 3 scenarios", () => {
  const openStates = (db: MemoryAdapter) => [...db.registry.values()].filter((i) => i.state === "intended" || i.state === "created").length;

  it("a teardown resumed after it abandoned an intent finishes, and the preview still lists the abandoned row", async () => {
    const db = freshDb();
    const victim = dataset.debates[5].rowId;
    db.table("debates").set(victim, { id: victim, user_id: "g1", is_sample: false, argument: "genuine" });
    await expect(execute({ dataset, plan, adapter: db, ...quiet })).rejects.toThrow(StopError);
    // The first teardown settles the intents, then dies at the first auth delete.
    const realDelete = db.deleteAuthUser.bind(db);
    let calls = 0;
    db.deleteAuthUser = async (id: string) => {
      if (++calls === 1) throw new Error("connection reset");
      return realDelete(id);
    };
    await expect(teardown(db, plan.runId, { rereadMs: 1 })).rejects.toThrow(/connection reset/);
    expect([...db.registry.values()].find((i) => i.row_id === victim)!.state).toBe("abandoned");
    const p = await preview(db, plan.runId);
    expect(p.foreign).toEqual([{ kind: "debate", rowId: victim }]);
    const r = await teardown(db, plan.runId, { rereadMs: 1 });
    expect(r.leftOver).toMatchObject({ debate: 0, auth_user: 0 });
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(db.table("debates").get(victim)).toMatchObject({ is_sample: false, argument: "genuine" });
    expect(openStates(db)).toBe(0);
    expect((await db.getRun(plan.runId))!.status).toBe("torn_down");
  });

  it("a par or percentile read inside a reader's write is read again before it fails", async () => {
    const db = freshDb();
    const r = await execute({ dataset, plan, adapter: db, ...quiet });
    // The first read lands between a reader's rating and the topic's par.
    const realPercentile = db.percentile.bind(db);
    let reads = 0;
    db.percentile = async (elo: number) => (++reads === 1 ? 0.5 : realPercentile(elo));
    const v = await validate(db, dataset, r.before, { rereadMs: 1 });
    expect(v.checks.filter((c) => !c.ok)).toEqual([]);
    expect(v.checks.find((c) => c.name.startsWith("elo_percentile"))!.detail).toMatch(/differed on the first read/);
    expect(reads).toBe(2);
    // A difference that holds on the second read fails.
    db.percentile = async () => 0.5;
    const again = await validate(db, dataset, r.before, { rereadMs: 1 });
    const failed = again.checks.filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual(["elo_percentile(1200) counts genuine profiles only"]);
    expect(failed[0].detail).toMatch(/read twice/);
  });
});
