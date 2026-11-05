// Taking the quiz from a challenge link saves the reader's result and
// accepts the challenge once. challenge_from references quiz_results(id)
// (supabase/migrations/0001_phase1.sql); the fake below enforces that
// foreign key as Postgres does, so writing a challenge's own id there
// fails the insert, as it did in production before 2026-11-04.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

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
    if (table === "quiz_results" && row.challenge_from != null && !tables.quiz_results.some((r) => r.id === row.challenge_from))
      return { error: { message: 'insert or update on table "quiz_results" violates foreign key constraint "quiz_results_challenge_from_fkey"' } };
    // quiz_version defaults to 1, as migration 0027 declares it.
    tables[table].push(table === "quiz_results" ? { quiz_version: 1, ...row } : { ...row });
    return { error: null };
  };
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  b.single = async () => ({ data: rows()[0] ?? null });
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

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }), isAdminConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "11111111-1111-4111-8111-111111111111" }) }),
}));

const { submitQuizResult } = await import("../src/app/actions");

const answers = {
  primary: "stoicism" as const,
  secondary: "virtue-ethics" as const,
  vector: { stoicism: 0.6, utilitarianism: 0.1, "virtue-ethics": 0.3 } as never,
  answers: [{ q: 1, opt: "a" }],
};

beforeEach(() => {
  tables.quiz_results = [{ id: "r-challenger", school: "utilitarianism", anon_id: "challenger-browser", user_id: null, quiz_version: 1 }];
  tables.challenges = [{ id: "c1", challenger_result_id: "r-challenger", challengee_result_id: null, status: "open" }];
});

describe("submitQuizResult from a challenge link", () => {
  it("saves the result, pointing at the challenger's result, and accepts the challenge", async () => {
    const res = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect(res).toMatchObject({ ok: true, challengerSchool: "utilitarianism" });
    const id = (res as { id: string }).id;
    expect(tables.quiz_results.find((r) => r.id === id)).toMatchObject({ challenge_from: "r-challenger" });
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: id, status: "accepted" });
  });

  it("accepts once: a second reader's result is saved, and the first stays the challengee", async () => {
    const first = (await submitQuizResult({ ...answers, challengeId: "c1" })) as { id: string };
    const second = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect(second).toMatchObject({ ok: true });
    // The second reader did not accept it, so reports no acceptance.
    expect((second as { challengerSchool?: string }).challengerSchool).toBeUndefined();
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: first.id, status: "accepted" });
  });

  it("does not reopen a finished challenge", async () => {
    Object.assign(tables.challenges[0], { challengee_result_id: "r-earlier", status: "complete" });
    tables.quiz_results.push({ id: "r-earlier" });
    expect(await submitQuizResult({ ...answers, challengeId: "c1" })).toMatchObject({ ok: true });
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: "r-earlier", status: "complete" });
  });

  it("treats an unknown challenge id as no challenge", async () => {
    const res = await submitQuizResult({ ...answers, challengeId: "nope" });
    expect(res).toMatchObject({ ok: true });
    expect(tables.quiz_results.at(-1)).toMatchObject({ challenge_from: null });
  });

  it("is unchanged without a challenge", async () => {
    expect(await submitQuizResult(answers)).toMatchObject({ ok: true });
    expect(tables.quiz_results.at(-1)).toMatchObject({ challenge_from: null });
  });

  it("does not make a challenger their own challengee", async () => {
    tables.quiz_results[0].anon_id = "11111111-1111-4111-8111-111111111111"; // this browser
    const res = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect(res).toMatchObject({ ok: true });
    expect((res as { challengerSchool?: string }).challengerSchool).toBeUndefined();
    expect(tables.quiz_results.at(-1)).toMatchObject({ challenge_from: null });
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: null, status: "open" });
  });

  it("writes a v1 result, naming no version, as before migration 0027", async () => {
    const res = (await submitQuizResult(answers)) as { id: string };
    const row = tables.quiz_results.find((r) => r.id === res.id)!;
    expect(row.quiz_version).toBe(1);
    expect(row.vector).toEqual(answers.vector);
  });

  it("treats a v2 challenger's challenge as no challenge, and never reads its school", async () => {
    Object.assign(tables.quiz_results[0], { quiz_version: 2, vector: null, map_x: 0.2, map_y: -0.3, school: "ubuntu" });
    const res = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect(res).toMatchObject({ ok: true });
    expect((res as { challengerSchool?: string }).challengerSchool).toBeUndefined();
    expect(tables.quiz_results.at(-1)).toMatchObject({ challenge_from: null });
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: null, status: "open" });
  });

  it("treats a challenger whose version is unknown as no challenge", async () => {
    delete tables.quiz_results[0].quiz_version;
    const res = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect((res as { challengerSchool?: string }).challengerSchool).toBeUndefined();
    expect(tables.challenges[0]).toMatchObject({ status: "open" });
  });

  it("never accepts a sample account's challenge", async () => {
    tables.challenges[0].is_sample = true;
    const res = await submitQuizResult({ ...answers, challengeId: "c1" });
    expect(res).toMatchObject({ ok: true });
    expect((res as { challengerSchool?: string }).challengerSchool).toBeUndefined();
    expect(tables.quiz_results.at(-1)).toMatchObject({ challenge_from: null });
    expect(tables.challenges[0]).toMatchObject({ challengee_result_id: null, status: "open" });
  });
});

