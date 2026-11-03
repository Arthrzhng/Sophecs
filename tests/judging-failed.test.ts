import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { JUDGING_FAILED_BODY, JUDGING_FAILED_REASON, JUDGING_FAILED_TITLE } from "../src/lib/judging-failed";

// Arthur's ruling of 2026-11-03: when every judge reply fails, the reader
// sees a clear message that judging failed, that it did not use one of
// their arguments for the day, and to try again; the attempt does not
// count against the daily cap; and it is logged. tests/judge-retry.test.ts
// drives judgeDebate's half (the retries, the logged validation error, the
// calls taken out of the cap). This holds the route and the editor to it.
// Both files are read rather than run: the route needs a live session and
// database, and the editor a judge to fail.

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const route = read("src/app/api/judge/route.ts");
const editor = read("src/components/debate/ArgumentEditor.tsx");

describe("the copy", () => {
  it("is the copy docs/daily-path-copy.md gives, with no em dash", () => {
    const doc = read("docs/daily-path-copy.md");
    expect(JUDGING_FAILED_TITLE).toBe("Judging failed.");
    expect(JUDGING_FAILED_BODY).toBe(
      "This did not use one of today's arguments, and your argument is saved. Try again."
    );
    expect(doc).toContain(`| Title | \`${JUDGING_FAILED_TITLE}\` |`);
    expect(doc).toContain(`| Body | \`${JUDGING_FAILED_BODY}\` |`);
    expect(JUDGING_FAILED_TITLE + JUDGING_FAILED_BODY).not.toMatch(/[–—]/);
  });
});

describe("/api/judge", () => {
  it("counts only calls that count toward the cap", () => {
    const start = route.indexOf('.from("ai_calls")');
    const query = route.slice(start, route.indexOf("dailyCount ?? 0", start));
    expect(query).toContain('.eq("kind", "judge")');
    expect(query).toContain('.eq("counts_toward_cap", true)');
  });

  it("answers a failed submission with the reason, the copy and a 502", () => {
    const start = route.indexOf("judged = await judgeDebate(");
    const handler = route.slice(start, route.indexOf("const { verdict } = judged;", start));
    expect(handler).toContain("reason: JUDGING_FAILED_REASON");
    expect(handler).toContain("error: `${JUDGING_FAILED_TITLE} ${JUDGING_FAILED_BODY}`");
    expect(handler).toContain("{ status: 502 }");
    // Logged in production as well, not only in development.
    expect(handler).toContain("console.error(");
    expect(handler).not.toContain('NODE_ENV !== "production"');
  });

  it("saves the argument before it calls the judge, which is what lets the copy say so", () => {
    const judged = route.indexOf("judged = await judgeDebate(");
    expect(route.indexOf('admin.from("debates").insert(')).toBeGreaterThan(-1);
    expect(route.indexOf('admin.from("debates").insert(')).toBeLessThan(judged);
    expect(route.indexOf('.update({ argument: body.argument })')).toBeLessThan(judged);
  });
});

describe("when the cap cannot be checked", () => {
  it("refuses the submission before anything is written or billed, rather than skip the cap", () => {
    const start = route.indexOf('.from("ai_calls")');
    const block = route.slice(start, route.indexOf('return paused("daily_cap")', start));
    expect(route.slice(route.lastIndexOf("const {", start), start)).toContain("error: capError");
    expect(block).toContain("if (capError) {");
    expect(block).toContain("{ status: 503 }");
    // Before any row is written or the judge is called.
    expect(start).toBeLessThan(route.indexOf('admin.from("debates").insert('));
    expect(start).toBeLessThan(route.indexOf("judged = await judgeDebate("));
  });
});

describe("a revision whose judging failed", () => {
  it("is tried again on its own unjudged row, not refused as already revised", () => {
    const flat = route.replace(/\s+/g, " ");
    expect(flat).toContain('.select("id, verdict, argument") .eq("parent_debate_id", parentRow.id)');
    expect(flat).toContain('if (existingChild?.verdict) return paused("already_revised");');
    expect(flat).toContain("const reuse = isRevision ? unjudgedRevision : recent;");
    expect(flat).toContain("const debateId = reuse?.id ?? newId();");
  });
});

describe("the argue screen", () => {
  it("shows the failure copy for the route's reason, not the generic error", () => {
    expect(JUDGING_FAILED_REASON).toBe("judging_failed");
    const check = editor.indexOf("response.reason === JUDGING_FAILED_REASON");
    expect(check).toBeGreaterThan(-1);
    // Before the generic not-ok branch, which would otherwise catch it.
    expect(check).toBeLessThan(editor.indexOf("if (!response.ok || !response.debateId)"));
    const block = editor.slice(editor.indexOf('status.kind === "judging_failed" && ('));
    expect(block.slice(0, 500)).toContain("title={JUDGING_FAILED_TITLE}");
    expect(block.slice(0, 500)).toContain("body={JUDGING_FAILED_BODY}");
  });
});
