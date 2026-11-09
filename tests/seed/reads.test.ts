// What each scheduled extension reads (Arthur, 2026-11-09, item 28: "keep
// hourly and cut what each run reads, so the job stays far under the free
// plan's egress"). An extension within a day of the last whole read reads
// the rows new since the run's end and counts the rest; once a day one
// reads the run whole; a canary or a full stage always does. The checks
// are the same, by name, and the database ends the same.
import { describe, expect, it } from "vitest";
import { MemoryAdapter } from "../../scripts/seed/adapter-memory";
import { runCi, READ_WHOLE_EVERY_MS, type Mode } from "../../scripts/seed/ci";
import { contentTopics } from "../../scripts/seed/topics";

const SEED = "reads-test-seed-0123456789abcdef";
const SMALL = { users: 160, anonResults: 150, challenges: 16, exchanges: 16, classes: 1 };
const T0 = Date.parse("2026-11-04T09:00:00.000Z");
const at = (hours: number) => new Date(T0 + hours * 3_600_000).toISOString();

function freshDb() {
  const db = new MemoryAdapter();
  for (const t of contentTopics())
    db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
  db.table("profiles").set("g1", { id: "g1", elo: 1234, streak: 7, school: "stoicism", is_sample: false });
  return db;
}
async function step(db: MemoryAdapter, mode: Mode, hours: number) {
  const lines: string[] = [];
  const before = { rows: db.rowsRead, cells: db.cellsRead };
  const out = await runCi({ mode, adapter: db, seed: SEED, projectRef: "tekifezydjlgxgndkxul", now: () => at(hours), log: (l) => lines.push(l), config: SMALL, batchSize: 100 });
  return { out, lines, rows: db.rowsRead - before.rows, cells: db.cellsRead - before.cells };
}
const checksOf = async (db: MemoryAdapter) => ((await db.listRuns())[0].last_report as { checks: { name: string; ok: boolean }[] }).checks;
const sampleRows = (db: MemoryAdapter) =>
  Object.fromEntries(["profiles", "quiz_results", "debates", "exchanges", "turns"].map((t) => [t, [...db.table(t).values()].filter((r) => r.is_sample !== false).map((r) => JSON.stringify(r)).sort()]));

async function started() {
  const db = freshDb();
  await step(db, "canary", 0);
  await step(db, "full", 1);
  return db;
}

describe("what a scheduled extension reads", () => {
  it("within a day of the last whole read: the new rows and counts, a small part of a whole read, with the same checks", { timeout: 180_000 }, async () => {
    const light = await started();
    const whole = await started();
    // Six hourly extensions on one; on the other the same ends, each read whole.
    let lightRows = 0;
    let wholeRows = 0;
    for (let h = 2; h <= 7; h++) {
      const a = await step(light, "extend", h);
      expect(a.out, `hour ${h}`).toMatchObject({ ok: true, outcome: "written" });
      expect(a.lines.join("\n"), `hour ${h}`).toMatch(/reading what is new since/);
      lightRows += a.rows;
      // The other run's last whole read is moved back a day, so each of its extensions reads whole.
      const run = (await whole.listRuns())[0];
      await whole.updateRun(run.id, { counts: { ...run.counts, read_whole_at: at(h - 25) } });
      const b = await step(whole, "extend", h);
      expect(b.out, `hour ${h}`).toMatchObject({ ok: true, outcome: "written" });
      expect(b.lines.join("\n"), `hour ${h}`).not.toMatch(/reading what is new since/);
      wholeRows += b.rows;
      expect((await checksOf(light)).map((c) => c.name), `hour ${h}`).toEqual((await checksOf(whole)).map((c) => c.name));
      expect((await checksOf(light)).every((c) => c.ok), `hour ${h}`).toBe(true);
    }
    // The same rows written, and a small part of the reading.
    expect(sampleRows(light)).toEqual(sampleRows(whole));
    expect(lightRows).toBeLessThan(wholeRows / 5);
  });

  it("reads the run whole once a day, and records when", { timeout: 120_000 }, async () => {
    const db = await started();
    const run = () => db.listRuns().then((r) => r[0]);
    expect((await run()).counts.read_whole_at).toBe(at(1));
    const hourly = await step(db, "extend", 2);
    expect(hourly.lines.join("\n")).toMatch(/reading what is new since/);
    expect((await run()).counts.read_whole_at).toBe(at(1));
    const daily = await step(db, "extend", 1 + READ_WHOLE_EVERY_MS / 3_600_000);
    expect(daily.lines.join("\n")).not.toMatch(/reading what is new since/);
    expect(daily.rows).toBeGreaterThan(5 * hourly.rows);
    expect((await run()).counts.read_whole_at).toBe(at(1 + READ_WHOLE_EVERY_MS / 3_600_000));
  });

  it("finds a changed older row within a day, though an hourly extension may not", { timeout: 180_000 }, async () => {
    const db = await started();
    const debates = db.table("debates");
    const [id, row] = [...debates].find(([, r]) => r.is_sample && typeof r.score === "number" && Date.parse(String(r.created_at)) < T0)!;
    debates.set(id, { ...row, score: Number(row.score) + 1 });
    let refusedAt: number | null = null;
    for (let h = 2; h <= 26 && refusedAt === null; h++) {
      const s = await step(db, "extend", h);
      if (s.out.outcome === "dry-run-failed") refusedAt = h;
    }
    expect(refusedAt).not.toBeNull();
    expect(refusedAt!).toBeLessThanOrEqual(1 + READ_WHOLE_EVERY_MS / 3_600_000);
  });

  it("reads the registry whole when its counts do not add up, and writes what is missing", { timeout: 120_000 }, async () => {
    const db = await started();
    const run = (await db.listRuns())[0];
    // An older row's registry entry no longer says created.
    const item = (await db.items(run.id, "quiz_result")).find((i) => i.state === "created")!;
    await db.setState(run.id, "quiz_result", [item.logical_id], "intended");
    const s = await step(db, "extend", 2);
    expect(s.lines.join("\n")).toMatch(/quiz_result: .* reading the registry whole/);
    expect(s.out).toMatchObject({ ok: true, outcome: "written" });
    expect((await db.items(run.id, "quiz_result", [item.logical_id]))[0].state).toBe("created");
    expect((await checksOf(db)).every((c) => c.ok)).toBe(true);
  });

  it("reads everything for a run that did not end complete", { timeout: 120_000 }, async () => {
    const db = await started();
    const run = (await db.listRuns())[0];
    await db.updateRun(run.id, { status: "failed", last_error: "a database error past the retries" });
    const s = await step(db, "extend", 2);
    expect(s.lines.join("\n")).not.toMatch(/reading what is new since/);
    expect(s.out).toMatchObject({ ok: true, outcome: "written" });
  });
});
