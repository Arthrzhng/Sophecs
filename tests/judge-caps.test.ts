// The daily call ceiling in /api/judge (Arthur's ruling of 2026-11-05 on
// Checkpoint A, item 6): every judge call a reader made in the last 24
// hours, retries and failed submissions included, held to 20, checked so
// that a submission starts only if all its attempts fit. This file reads
// the source for the constants, the query's filters and the copy, with
// comments blanked so a commented-out check cannot pass; what the route
// does with them is run in tests/judge-ceiling-route.test.ts.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_JUDGE_ATTEMPTS } from "../src/lib/anthropic";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1").replace(/\s+/g, " ");
const route = codeOnly(read("src/app/api/judge/route.ts"));
const sql = codeOnly(read("supabase/migrations/0028_judge_reservations.sql").replace(/--[^\n]*/g, ""));

describe("/api/judge's daily call ceiling", () => {
  it("is 20, and five arguments at every attempt always fit under it", () => {
    expect(route).toContain("const JUDGE_CALL_CEILING = 20;");
    expect(route).toContain("const DAILY_CAP = 5;");
    expect(5 * MAX_JUDGE_ATTEMPTS).toBeLessThanOrEqual(20);
  });

  it("is checked and claimed in one step, with the route's own numbers (migration 0028)", () => {
    expect(route).toContain(
      'await admin.rpc("reserve_judge_submission", { p_user: user.id, p_cap: DAILY_CAP, p_ceiling: JUDGE_CALL_CEILING, p_attempts: MAX_JUDGE_ATTEMPTS, p_hold_seconds: RESERVATION_HOLD_SECONDS, });'
    );
    expect(route).toContain('if (reserved === "call_ceiling") { return paused("call_ceiling"); }');
  });

  it("counts every judge call in the window for the ceiling, and only cap calls for the cap", () => {
    expect(sql).toContain("select count(*) filter (where counts_toward_cap), count(*) into v_arguments, v_calls from public.ai_calls where user_id = p_user and kind = 'judge' and created_at >= v_since;");
    expect(sql).toContain("v_since timestamptz := now() - interval '24 hours';");
    expect(sql).toContain("if v_arguments + v_held >= p_cap then return 'daily_cap';");
    expect(sql).toContain("if v_calls + (v_held + 1) * p_attempts > p_ceiling then return 'call_ceiling';");
  });

  it("holds a lock per reader while it counts and claims", () => {
    expect(sql).toContain("perform pg_advisory_xact_lock(hashtextextended('sophecs.judge_reservation:' || p_user::text, 0));");
    // The lock comes before either count.
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("from public.ai_calls"));
  });

  it("fails closed on an error or an answer it does not know", () => {
    expect(route).toContain(
      'if (reserveError || reservation === null) { console.error("[judge] daily cap could not be checked:", reserveError?.message ?? `got ${String(reserved)}`); return NextResponse.json({ ok: false, error: CAP_UNCHECKED }, { status: 503 }); }'
    );
  });

  it("releases the reservation however the submission ends", () => {
    expect(route).toContain(
      'try { return await judge(request, held); } finally { if (held.reservation !== null) { const { error } = await createAdminClient().rpc("release_judge_reservation", { p_id: held.reservation });'
    );
    expect(route).toContain("held.reservation = reservation;");
  });

  it("comes before anything is written or billed", () => {
    const ceiling = route.indexOf('return paused("call_ceiling");');
    expect(ceiling).toBeGreaterThan(-1);
    expect(ceiling).toBeLessThan(route.indexOf('admin.from("debates").insert('));
    expect(ceiling).toBeLessThan(route.indexOf("judged = await judgeDebate("));
  });

  it("stops on a budget it could not read with its own line, not the 'limit reached' notice", () => {
    expect(route).toContain(
      'const BUDGET_UNCHECKED = "The spending limit could not be checked, so nothing was sent to the judge.";'
    );
    expect(route).toContain(
      'const budget = await budgetState(); if (budget === "unread") { return NextResponse.json({ ok: false, error: BUDGET_UNCHECKED }, { status: 503 }); } if (budget === "over") { return paused("budget"); }'
    );
  });

  it("has its own copy on the argue screen and its own analytics reason", () => {
    const editor = read("src/components/debate/ArgumentEditor.tsx");
    expect(editor).toContain("call_ceiling: {");
    expect(editor).toContain('title: "That is all the judging for today."');
    expect(read("src/lib/analytics/events.ts")).toContain('| "call_ceiling"');
  });

  it("says the spending limit is monthly, since it is (src/lib/budget.ts)", () => {
    const editor = read("src/components/debate/ArgumentEditor.tsx");
    const start = editor.indexOf("  budget: {");
    const budget = editor.slice(start, editor.indexOf("},", start));
    expect(budget).toContain('title: "Judging is paused for the month."');
    expect(budget).toContain("The judge has a monthly spending limit and it has been reached.");
    expect(budget).toContain("once the limit resets at the start of next month");
    expect(budget).not.toMatch(/today|daily/i);
  });
});
