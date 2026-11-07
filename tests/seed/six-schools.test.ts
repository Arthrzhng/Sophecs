// A run made with quiz v2 (Arthur, 2026-11-07, Gate 4 item 13: "the fresh
// sample run covers all six schools, placed by quiz v2"): every sample is
// placed by quiz v2 as the app would place a reader, all six schools are
// active in every week, the template verdicts pass the judge's schema on a
// six-school build, and a run that names no quiz is untouched.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { emailTag, generate, RUN_QUIZ, type Dataset } from "../../scripts/seed/generate";
import { BANK_SCHOOLS, loadBanks } from "../../scripts/seed/banks";
import { contentTopics } from "../../scripts/seed/topics";
import { baseHash, datasetForPlan, manifestHash } from "../../scripts/seed/plan";
import { MemoryAdapter } from "../../scripts/seed/adapter-memory";
import { execute } from "../../scripts/seed/engine";
import { validate } from "../../scripts/seed/validate";
import { scoreQuizV2 } from "../../src/lib/quiz-v2-score";
import { loadQuizV2ForTest } from "../../src/lib/quiz-v2";
import { RANK_MIN_ARGUMENTS } from "../../src/lib/school-table";
import { SMALL, smallPlan } from "./fixture";

// Production's volumes, a base window ending on a Monday, and the week
// after it: what the launch week of a fresh run looks like.
const LAUNCH_WEEK = { from: "2026-11-09T00:00:00.000Z", to: "2026-11-16T00:00:00.000Z" };
let cached: Dataset | null = null;
const six = () =>
  (cached ??= generate(
    {
      seed: "six-schools",
      from: "2026-09-18T00:00:00.000Z",
      baseTo: LAUNCH_WEEK.from,
      to: LAUNCH_WEEK.to,
      users: 3278,
      anonResults: 4917,
      challenges: 328,
      exchanges: 492,
      classes: 10,
      quiz: 2,
      topics: contentTopics(),
    },
    loadBanks()
  ));

const share = (xs: string[]) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / xs.length]));
};

describe("a sample run made with quiz v2", () => {
  // Production's volumes take a few seconds to generate, once for the file.
  beforeAll(() => void six(), 60_000);

  it("places every sample by quiz v2, with the app's own questions and scorer, in the shape migration 0027 requires", () => {
    const quiz = loadQuizV2ForTest();
    const options = new Map(quiz.questions.flatMap((q) => q.options.map((o) => [o.id, o] as const)));
    const ds = six();
    expect(ds.quizResults.length).toBeGreaterThan(8000);
    for (const { row } of ds.quizResults) {
      expect(row.quiz_version).toBe(2);
      expect(row.vector).toBeNull();
      expect(row.map_x).toBeGreaterThanOrEqual(-1);
      expect(row.map_x).toBeLessThanOrEqual(1);
      expect(row.map_y).toBeGreaterThanOrEqual(-1);
      expect(row.map_y).toBeLessThanOrEqual(1);
      expect(row.answers.map((a) => a.q)).toEqual(quiz.questions.map((q) => q.id));
      const scored = scoreQuizV2(row.answers.map((a) => options.get(a.opt)!), quiz.schools);
      expect([row.school, row.secondary, row.map_x, row.map_y]).toEqual([scored.primary, scored.secondary, scored.point.x, scored.point.y]);
    }
  });

  it("is the dataset this file was written against, pinned at production volume", () => {
    // Beside the small pins in determinism.test.ts: eight thousand quiz
    // results and every exchange pair reach paths a small run need not.
    expect(manifestHash(six())).toBe("1edf1643d68dfd6b9b7085892c892159403d45b2d8e89c9fb97a7fe93fc5f9dc");
  });

  it("covers all six schools about equally", () => {
    const ds = six();
    for (const shares of [share(ds.quizResults.map((q) => q.row.school)), share(ds.profiles.map((p) => p.row.school))]) {
      expect(Object.keys(shares).sort()).toEqual([...BANK_SCHOOLS].sort());
      for (const [school, s] of Object.entries(shares)) {
        expect(s, school).toBeGreaterThan(0.12);
        expect(s, school).toBeLessThan(0.22);
      }
    }
  });

  it("gives every school enough judged originals in its launch week to be ranked", () => {
    const ds = six();
    const inWeek = ds.debates
      .map((d) => d.row)
      .filter((d) => d.kind === "original" && !d.rejected && d.score !== null && d.created_at >= LAUNCH_WEEK.from && d.created_at < LAUNCH_WEEK.to);
    for (const school of BANK_SCHOOLS) expect(inWeek.filter((d) => d.school === school).length, school).toBeGreaterThanOrEqual(RANK_MIN_ARGUMENTS);
  });

  it("writes verdicts the judge's schema accepts on a six-school build, naming each school by its own name and article", async () => {
    vi.stubEnv("SIX_SCHOOLS", "1");
    vi.resetModules();
    const { VerdictSchema } = await import("../../src/lib/judge/schema");
    vi.unstubAllEnvs();
    const ds = six();
    const named = new Set<string>();
    for (const { row } of ds.debates) {
      const parsed = VerdictSchema.safeParse(row.verdict);
      expect(parsed.success, `${row.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      if (row.verdict.rejected) continue;
      const v = row.verdict;
      if (v.unanswered_objection) named.add(v.unanswered_objection.school);
      const words = [v.strongest_move, v.weakest_move, v.a_stronger_version_would, v.verdict_line, v.improvement_note ?? ""].join(" ");
      expect(words, row.id).not.toMatch(/\ba Ubuntu|\b(confucian|ubuntu|buddhist)\b/);
    }
    // Rivals are the passages' own: the named voices of each school's
    // best-known objection, all among the six, the new three included.
    for (const school of named) expect(BANK_SCHOOLS).toContain(school);
    expect(named.has("ubuntu") && named.has("confucian")).toBe(true);
  });

  it("argues every exchange turn without saying a sentence twice, among schools with no objection between them too", () => {
    const ds = six();
    expect(ds.turns.length).toBeGreaterThan(500);
    for (const { row } of ds.turns) {
      const sentences = row.body.split(/(?<=[.!?])\s+/);
      expect(new Set(sentences).size, row.id).toBe(sentences.length);
    }
  });

  it("tags its addresses with HMAC-SHA256 of the run and the user's number, keyed by the seed, as the launch steps set out", () => {
    const ds = six();
    for (const u of ds.authUsers.slice(0, 200)) {
      const n = Number(u.logicalId.split(":")[1]);
      const tag = createHmac("sha256", "six-schools").update(`${ds.runId}/${n}`).digest("hex").slice(0, 12);
      expect(u.row.email).toBe(`seed+${ds.runId}-${n}-${tag}@sophecs.test`);
    }
    expect(new Set(ds.authUsers.map((u) => u.row.email)).size).toBe(ds.authUsers.length);
    expect(emailTag("other-seed", ds.runId, 0)).not.toBe(emailTag("six-schools", ds.runId, 0));
  });

  it("is a run of its own: the quiz is in its base hash and its plan, and the plan regenerates it", () => {
    const { plan, dataset } = smallPlan({ quiz: 2 });
    expect(plan.config.quiz).toBe(2);
    expect(plan.baseHash).not.toBe(smallPlan().plan.baseHash);
    const again = datasetForPlan(plan, contentTopics());
    expect(manifestHash(again)).toBe(plan.manifestHash);
    expect(dataset.quizResults.every((q) => q.row.quiz_version === 2)).toBe(true);
  });

  it("writes and validates through the engine, the quiz v2 columns included", async () => {
    const { plan, dataset } = smallPlan({ quiz: 2 });
    const db = new MemoryAdapter();
    for (const t of plan.topics) db.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
    const r = await execute({ dataset, plan, adapter: db, retryBaseMs: 1, batchSize: 100 });
    expect((await validate(db, dataset, r.before)).checks.filter((c) => !c.ok)).toEqual([]);
    // A point written wrong is caught by the spot check.
    const wrong = new MemoryAdapter();
    for (const t of plan.topics) wrong.table("debate_topics").set(t.slug, { id: t.slug, slug: t.slug, motion: t.motion, active: true, par_elo: 1200, par_n: 0 });
    const w = await execute({ dataset, plan, adapter: wrong, retryBaseMs: 1, batchSize: 100 });
    for (const row of wrong.table("quiz_results").values()) row.map_x = 0;
    const checks = (await validate(wrong, dataset, w.before, { spot: 1000 })).checks;
    expect(checks.find((c) => c.name === "spot check: quiz_results")?.ok).toBe(false);
  });
});

describe("a quiz v2 run's schools", () => {
  it("come from the quiz file, and the run is refused unless the passages, closings and verdicts' lines cover the same six", () => {
    const banks = loadBanks();
    const gen = { ...SMALL, quiz: 2 as const, topics: contentTopics() };
    const closings = Object.fromEntries(Object.entries(banks.closings).filter(([s]) => s !== "buddhist"));
    expect(() => generate(gen, { ...banks, closings: closings as typeof banks.closings })).toThrow(/the closings/);
    const fragments = { ...banks.fragments, "no-decision": { ...banks.fragments["no-decision"], schools: Object.fromEntries(Object.entries(banks.fragments["no-decision"].schools).filter(([s]) => s !== "ubuntu")) } };
    expect(() => generate(gen, { ...banks, fragments: fragments as typeof banks.fragments })).toThrow(/the passages of no-decision/);
  });
});

describe("a quiz v2 run's verdicts", () => {
  it("are refused unless the verdicts' lines cover the same six as the quiz", async () => {
    vi.resetModules();
    vi.doMock("../../scripts/seed/verdicts", async (importOriginal) => {
      const real = await importOriginal<typeof import("../../scripts/seed/verdicts")>();
      return { ...real, FEATURE_SCHOOLS: real.FEATURE_SCHOOLS.filter((s) => s !== "confucian") };
    });
    try {
      const fresh = await import("../../scripts/seed/generate");
      const { loadBanks: load } = await import("../../scripts/seed/banks");
      expect(() => fresh.generate({ ...SMALL, quiz: 2, topics: contentTopics() }, load())).toThrow(/the template verdicts' lines/);
    } finally {
      vi.doUnmock("../../scripts/seed/verdicts");
      vi.resetModules();
    }
  });
});

describe("a run that names no quiz", () => {
  it("hashes and plans exactly as before: the base hash main gave at 3008b29, and no quiz in its plan", () => {
    expect(baseHash({ ...SMALL, topics: contentTopics() })).toBe("4b7758b789ced500ab02002393f9359689910253775d9ba907c610dfbee1a7be");
    expect("quiz" in smallPlan().plan.config).toBe(false);
  });

  it("is still what the scheduled job makes, until the launch merge sets RUN_QUIZ to 2 after the teardown", () => {
    expect(RUN_QUIZ).toBeUndefined();
  });
});
