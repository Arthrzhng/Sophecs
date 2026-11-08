// submitQuizResultV2 (src/app/actions.ts): on a SIX_SCHOOLS build it
// scores the answers itself and writes a v2 row, and from the launch it
// moves a signed-in reader's school and takes up any challenger's
// challenge, as v1 does (docs/decisions.md, "Stage 5, step 4", "To undo at
// launch"). On any other build it writes nothing. The fake database is the one tests/challenge-accept.test.ts
// uses, with 0027's shape check added.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadQuizV2ForTest } from "../src/lib/quiz-v2";
import { scoreQuizV2 } from "../src/lib/quiz-v2-score";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const retakes: unknown[] = [];

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let returning = false;
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  b.select = () => {
    if (patch) returning = true;
    return b;
  };
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.is = (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b);
  b.update = (p: Row) => ((patch = p), b);
  b.insert = async (row: Row) => {
    if (table === "quiz_results") {
      const v = row.quiz_version ?? 1;
      // quiz_results_shape_by_version (migration 0027).
      const ok =
        (v === 1 && row.vector != null && row.map_x == null && row.map_y == null) ||
        (v === 2 &&
          row.vector == null &&
          typeof row.map_x === "number" && Math.abs(row.map_x) <= 1 &&
          typeof row.map_y === "number" && Math.abs(row.map_y) <= 1);
      if (!ok) return { error: { message: 'violates check constraint "quiz_results_shape_by_version"' } };
    }
    tables[table].push({ ...row });
    return { error: null };
  };
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  b.then = (resolve: (v: unknown) => unknown) => {
    if (patch) {
      const hit = rows();
      for (const r of hit) Object.assign(r, patch);
      return resolve({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
    }
    return resolve({ data: rows(), error: null });
  };
  return b;
}

let user: { id: string } | null = null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }), isAdminConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "reader-browser" }) }) }));
vi.mock("@/lib/claim", () => ({
  retakeQuizSchool: async (...args: unknown[]) => (retakes.push(args), { changed: true, from: "stoicism", to: "confucian" }),
}));

const quiz = loadQuizV2ForTest();
// A reader who always takes the option nearest Confucianism (angle 50).
const target = { x: Math.cos((50 * Math.PI) / 180), y: Math.sin((50 * Math.PI) / 180) };
const confucianChoices = quiz.questions.map(
  (q) => [...q.options].sort((a, b) => (a.vector.x - target.x) ** 2 + (a.vector.y - target.y) ** 2 - ((b.vector.x - target.x) ** 2 + (b.vector.y - target.y) ** 2))[0]
);
const answers = confucianChoices.map((o, i) => ({ q: quiz.questions[i].id, opt: o.id }));
const expected = scoreQuizV2(confucianChoices, quiz.schools);

async function action(flag: "0" | "1") {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  return (await import("../src/app/actions")).submitQuizResultV2;
}

beforeEach(() => {
  user = null;
  retakes.length = 0;
  tables.quiz_results = [
    { id: "r-v1", school: "utilitarianism", anon_id: "someone", user_id: null, quiz_version: 1 },
    { id: "r-v2", school: "ubuntu", anon_id: "someone", user_id: null, quiz_version: 2 },
    { id: "r-own", school: "buddhist", anon_id: "reader-browser", user_id: null, quiz_version: 2 },
  ];
  tables.challenges = [
    { id: "c-v1", challenger_result_id: "r-v1", challengee_result_id: null, status: "open" },
    { id: "c-v2", challenger_result_id: "r-v2", challengee_result_id: null, status: "open" },
    { id: "c-own", challenger_result_id: "r-own", challengee_result_id: null, status: "open" },
  ];
});
afterEach(() => vi.unstubAllEnvs());

const saved = (id: string) => tables.quiz_results.find((r) => r.id === id)!;

describe("submitQuizResultV2 on a SIX_SCHOOLS build", () => {
  it("scores the answers on the server and writes a v2 row: a point, no vector", async () => {
    const res = await (await action("1"))({ answers });
    expect(expected.primary).toBe("confucian");
    expect(res).toMatchObject({ ok: true, primary: "confucian", secondary: expected.secondary, point: expected.point });
    const row = saved((res as { id: string }).id);
    expect(row).toMatchObject({
      quiz_version: 2,
      vector: null,
      school: "confucian",
      secondary: expected.secondary,
      map_x: expected.point.x,
      map_y: expected.point.y,
      anon_id: "reader-browser",
      challenge_from: null,
    });
    expect(row.answers).toEqual(answers);
  });

  it("moves a signed-in reader's school to the result's, and says so", async () => {
    user = { id: "u1" };
    const res = await (await action("1"))({ answers });
    expect(res).toMatchObject({ ok: true, schoolChanged: { from: "stoicism", to: "confucian" } });
    expect(saved((res as { id: string }).id)).toMatchObject({ user_id: "u1" });
    expect(retakes).toHaveLength(1);
    expect((retakes[0] as unknown[]).slice(1)).toEqual(["u1", (res as { primary: string }).primary]);
  });

  it("moves no school for a reader who is not signed in", async () => {
    const res = await (await action("1"))({ answers });
    expect(res).toMatchObject({ ok: true });
    expect((res as { schoolChanged?: unknown }).schoolChanged).toBeUndefined();
    expect(retakes).toEqual([]);
  });

  it("refuses answers that are missing, out of order or not the question's", async () => {
    const submit = await action("1");
    const before = tables.quiz_results.length;
    expect(await submit({ answers: answers.slice(0, 9) })).toMatchObject({ ok: false });
    expect(await submit({ answers: [answers[1], answers[0], ...answers.slice(2)] })).toMatchObject({ ok: false });
    expect(await submit({ answers: [{ q: 1, opt: "2a" }, ...answers.slice(1)] })).toMatchObject({ ok: false });
    expect(await submit({ answers: undefined as never })).toMatchObject({ ok: false });
    expect(tables.quiz_results).toHaveLength(before);
  });

  it("takes up a v2 challenger's challenge", async () => {
    const res = await (await action("1"))({ answers, challengeId: "c-v2" });
    expect(res).toMatchObject({ ok: true, challengerSchool: "ubuntu" });
    const id = (res as { id: string }).id;
    expect(saved(id)).toMatchObject({ challenge_from: "r-v2" });
    expect(tables.challenges.find((c) => c.id === "c-v2")).toMatchObject({ challengee_result_id: id, status: "accepted" });
  });

  it("takes up a v1 challenger's challenge too", async () => {
    const res = await (await action("1"))({ answers, challengeId: "c-v1" });
    expect(res).toMatchObject({ ok: true, challengerSchool: "utilitarianism" });
    const id = (res as { id: string }).id;
    expect(saved(id)).toMatchObject({ challenge_from: "r-v1" });
    expect(tables.challenges.find((c) => c.id === "c-v1")).toMatchObject({ challengee_result_id: id, status: "accepted" });
  });

  it("does not let a reader take up their own challenge", async () => {
    const res = await (await action("1"))({ answers, challengeId: "c-own" });
    expect(saved((res as { id: string }).id)).toMatchObject({ challenge_from: null });
    expect(tables.challenges.find((c) => c.id === "c-own")).toMatchObject({ status: "open" });
  });
});

describe("submitQuizResultV2 on a build without SIX_SCHOOLS", () => {
  it("writes nothing", async () => {
    const before = tables.quiz_results.length;
    expect(await (await action("0"))({ answers, challengeId: "c-v2" })).toMatchObject({ ok: false });
    expect(tables.quiz_results).toHaveLength(before);
    expect(tables.challenges.find((c) => c.id === "c-v2")).toMatchObject({ status: "open" });
  });
});
