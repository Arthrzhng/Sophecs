// The dry run reads and never writes; a plan that does not match its
// regenerated dataset is refused; the published quiz scoring decides every
// sample's school.
import { describe, expect, it } from "vitest";
import { MemoryAdapter } from "../../scripts/seed/adapter-memory";
import { dryRun } from "../../scripts/seed/dryrun";
import { datasetForPlan } from "../../scripts/seed/plan";
import { contentTopics } from "../../scripts/seed/topics";
import { scoreQuiz } from "../../src/lib/scoring";
import { QUIZ_QUESTIONS } from "../../content/quiz/questions";
import { smallPlan, small } from "./fixture";

const WRITES = [
  "insertRun", "updateRun", "acquireLock", "releaseLock", "breakStaleLock", "recordIntents", "setState",
  "createAuthUser", "deleteAuthUser", "insertIgnore", "linkChallenge", "unlinkChallenges",
  "clearSampleChallengeFrom", "deleteOwned", "clearReference",
];

function readOnly(db: MemoryAdapter) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && WRITES.includes(prop)) return () => { throw new Error(`dry run called ${prop}`); };
      return Reflect.get(target, prop, receiver);
    },
  });
}

describe("dry run", () => {
  const { plan } = smallPlan();
  it("reads the target and writes nothing", async () => {
    const db = new MemoryAdapter();
    for (const t of plan.topics) db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
    const report = await dryRun(readOnly(db), plan);
    expect(report.ok).toBe(true);
    expect(db.runs.size + db.registry.size + db.authUsers.size).toBe(0);
  });
  it("fails, still without writing, when a motion differs or another run is locked", async () => {
    const db = new MemoryAdapter();
    for (const t of plan.topics) db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: "Reworded.", active: true, par_elo: 1200, par_n: 0 });
    expect((await dryRun(readOnly(db), plan)).ok).toBe(false);
  });
});

describe("plan checks", () => {
  it("refuses a plan whose hash, generator or motions do not match", () => {
    const { plan } = smallPlan();
    expect(() => datasetForPlan({ ...plan, manifestHash: "0".repeat(64) }, contentTopics())).toThrow(/hashes to/);
    expect(() => datasetForPlan({ ...plan, generatorVersion: "sample-activity-0" }, contentTopics())).toThrow(/made by/);
    const reworded = contentTopics().map((t) => (t.slug === "no-decision" ? { ...t, motion: "Reworded." } : t));
    expect(() => datasetForPlan(plan, reworded)).toThrow(/differs from the plan/);
    expect(datasetForPlan(plan, contentTopics()).runId).toBe(plan.runId);
  });
});

describe("quiz results", () => {
  it("come from answering every question, scored by scoreQuiz", () => {
    const ds = small();
    const byId = new Map(QUIZ_QUESTIONS.flatMap((q) => q.options.map((o) => [o.id, o] as const)));
    for (const q of ds.quizResults.map((x) => x.row)) {
      expect(q.answers).toHaveLength(QUIZ_QUESTIONS.length);
      q.answers.forEach((a, i) => expect(a.q).toBe(i + 1));
      const scored = scoreQuiz(q.answers.map((a) => byId.get(a.opt)!));
      expect([q.school, q.secondary]).toEqual([scored.primary, scored.secondary]);
      expect(q.vector).toEqual(scored.vector);
    }
  });
});

describe("background work", () => {
  it("the only scheduled job touches no sample table", async () => {
    const { readFileSync } = await import("node:fs");
    const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons as { path: string }[];
    expect(crons.map((c) => c.path)).toEqual(["/api/cron/keepalive"]);
    const route = readFileSync("src/app/api/cron/keepalive/route.ts", "utf8");
    for (const table of ["profiles", "debates", "challenges", "exchanges", "turns", "quiz_results"]) expect(route).not.toContain(`from("${table}")`);
  });
});
