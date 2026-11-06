// submitQuizResult (src/app/actions.ts) scores v1 answers on the server
// (Arthur, 2026-11-06: "fix the v1 quiz hole by scoring v1 on the server").
// Before, the school, secondary and vector the page sent were stored as
// given, so any school could be written to a result, its share card and a
// signed-in reader's profile. Now only the answers decide the school: they
// are checked against the question bank and scored with the page's own
// scorer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUIZ_QUESTIONS } from "../content/quiz/questions";
import { scoreQuiz } from "../src/lib/scoring";
import type { QuizSchoolId } from "../src/lib/types";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const retakes: unknown[][] = [];

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.insert = async (row: Row) => (tables[table].push({ ...row }), { error: null });
  b.maybeSingle = async () => ({ data: rows()[0] ?? null });
  return b;
}

let user: { id: string } | null = null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }), isAdminConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "reader-browser" }) }) }));
vi.mock("@/lib/claim", () => ({
  retakeQuizSchool: async (...args: unknown[]) => (retakes.push(args), { changed: false }),
}));

const { submitQuizResult } = await import("../src/app/actions");

// Each question's option leaning furthest towards one school.
const towards = (school: QuizSchoolId) =>
  QUIZ_QUESTIONS.map((q) => [...q.options].sort((a, b) => b.vector[school] - a.vector[school])[0]);
const answersFor = (school: QuizSchoolId) => towards(school).map((o, i) => ({ q: QUIZ_QUESTIONS[i].id, opt: o.id }));

beforeEach(() => {
  user = null;
  retakes.length = 0;
  tables.quiz_results = [];
  tables.challenges = [];
});

const saved = (id: string) => tables.quiz_results.find((r) => r.id === id)!;

describe("submitQuizResult scores v1 on the server", () => {
  it("stores the school the answers score to, and returns it", async () => {
    const expected = scoreQuiz(towards("utilitarianism"));
    expect(expected.primary).toBe("utilitarianism");
    const res = await submitQuizResult({ answers: answersFor("utilitarianism") });
    expect(res).toMatchObject({ ok: true, primary: "utilitarianism", secondary: expected.secondary });
    expect(saved((res as { id: string }).id)).toMatchObject({
      school: "utilitarianism",
      secondary: expected.secondary,
      vector: expected.vector,
      answers: answersFor("utilitarianism"),
    });
  });

  it("ignores a school, secondary or vector the page sends", async () => {
    const forged = {
      answers: answersFor("stoicism"),
      primary: "virtue-ethics",
      secondary: "utilitarianism",
      vector: { stoicism: 0, utilitarianism: 0, "virtue-ethics": 1 },
    };
    const res = await submitQuizResult(forged as never);
    const expected = scoreQuiz(towards("stoicism"));
    expect(expected.secondary).toBe("virtue-ethics");
    expect(res).toMatchObject({ ok: true, primary: "stoicism", secondary: "virtue-ethics" });
    const row = saved((res as { id: string }).id);
    expect(row.school).toBe("stoicism");
    expect(row.secondary).toBe("virtue-ethics");
    expect(row.vector).toEqual(expected.vector);
  });

  it("moves a signed-in reader's school to the scored one, never the sent one", async () => {
    user = { id: "u1" };
    await submitQuizResult({ answers: answersFor("virtue-ethics"), primary: "stoicism" } as never);
    expect(retakes).toHaveLength(1);
    expect(retakes[0][1]).toBe("u1");
    expect(retakes[0][2]).toBe("virtue-ethics");
  });

  it("refuses answers that are missing, out of order, not the question's, or not answers at all, and writes nothing", async () => {
    const good = answersFor("stoicism");
    for (const answers of [
      good.slice(0, 9),
      [...good, good[0]],
      [good[1], good[0], ...good.slice(2)],
      [{ q: 1, opt: "2a" }, ...good.slice(1)],
      // Question 1's own option, filed under question 2.
      [{ q: 2, opt: "1a" }, ...good.slice(1)],
      [{ q: 1 }, ...good.slice(1)],
      null,
    ]) {
      expect(await submitQuizResult({ answers } as never)).toEqual({ ok: false, error: "Every question needs an answer." });
    }
    expect(tables.quiz_results).toEqual([]);
    expect(retakes).toEqual([]);
  });

  it("breaks a tie by question 10, as the page does", async () => {
    // A set whose top two schools tie: question 10 decides, so scoring the
    // same answers in another order would name the other school.
    const ids = ["1c", "2b", "3c", "4b", "5b", "6c", "7c", "8b", "9a", "10a"];
    const chosen = ids.map((id, i) => QUIZ_QUESTIONS[i].options.find((o) => o.id === id)!);
    expect(scoreQuiz(chosen).primary).toBe("utilitarianism");
    expect(scoreQuiz([...chosen].reverse()).primary).toBe("virtue-ethics");
    const res = await submitQuizResult({ answers: ids.map((opt, i) => ({ q: QUIZ_QUESTIONS[i].id, opt })) });
    expect(res).toMatchObject({ ok: true, primary: "utilitarianism", secondary: "virtue-ethics" });
  });

  it("stores only each answer's question and option", async () => {
    const extra = answersFor("stoicism").map((a) => ({ ...a, note: "x".repeat(10_000) }));
    const res = await submitQuizResult({ answers: extra } as never);
    expect(saved((res as { id: string }).id).answers).toEqual(answersFor("stoicism"));
  });
});
