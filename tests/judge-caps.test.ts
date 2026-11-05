// The daily call ceiling in /api/judge (Arthur's ruling of 2026-11-05 on
// Checkpoint A, item 6): every judge call a reader made in the last 24
// hours, retries and failed submissions included, held to 20, checked so
// that a submission starts only if all its attempts fit. The route needs a
// live session and database, so it is read rather than run, with comments
// blanked so a commented-out check cannot pass.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_JUDGE_ATTEMPTS } from "../src/lib/anthropic";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1").replace(/\s+/g, " ");
const route = codeOnly(read("src/app/api/judge/route.ts"));

describe("/api/judge's daily call ceiling", () => {
  it("is 20, and five arguments at every attempt always fit under it", () => {
    expect(route).toContain("const JUDGE_CALL_CEILING = 20;");
    expect(route).toContain("const DAILY_CAP = 5;");
    expect(5 * MAX_JUDGE_ATTEMPTS).toBeLessThanOrEqual(20);
  });

  it("counts every judge call in the window, not only those on the argument cap", () => {
    const start = route.indexOf("const { count: callCount, error: ceilingError } = await admin");
    expect(start).toBeGreaterThan(-1);
    const query = route.slice(start, route.indexOf(";", start));
    expect(query).toContain('.from("ai_calls")');
    expect(query).toContain('.eq("user_id", user.id)');
    expect(query).toContain('.eq("kind", "judge")');
    expect(query).toContain('.gte("created_at", sinceDaily)');
    expect(query).not.toContain("counts_toward_cap");
  });

  it("refuses a submission whose attempts would pass it, and fails closed on an error", () => {
    expect(route).toContain(
      'if (ceilingError) { console.error("[judge] daily call ceiling could not be checked:", ceilingError.message); return NextResponse.json({ ok: false, error: CAP_UNCHECKED }, { status: 503 }); }'
    );
    expect(route).toContain('if ((callCount ?? 0) + MAX_JUDGE_ATTEMPTS > JUDGE_CALL_CEILING) { return paused("call_ceiling"); }');
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
});
