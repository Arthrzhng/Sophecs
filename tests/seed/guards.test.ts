import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLocalUrl, checkProduction, localTarget, parseEnvFile, productionTarget, GuardError } from "../../scripts/seed/env";
import { checkPlanQuiz, parseFlags, refuseUnsupported } from "../../scripts/seed/cli";

const REF = "tekifezydjlgxgndkxul";
const jwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "c2ln"].join(".");
const KEY = jwt({ role: "service_role", ref: REF });

describe("local target", () => {
  it("accepts only this machine", () => {
    expect(checkLocalUrl("postgres://postgres@127.0.0.1:55432/sophecs_sample").host).toBe("127.0.0.1");
    expect(checkLocalUrl("postgresql://postgres@localhost/sophecs_sample").host).toBe("127.0.0.1");
    for (const bad of [
      "postgres://postgres@db.tekifezydjlgxgndkxul.supabase.co:5432/postgres",
      "postgres://postgres@10.0.0.5/sophecs",
      "postgres://postgres@127.0.0.1.evil.example/sophecs",
      "https://127.0.0.1/sophecs",
      "postgres://postgres@127.0.0.1/sophecs?host=db.example.com",
      "not a url",
    ])
      expect(() => checkLocalUrl(bad), bad).toThrow(GuardError);
  });

  it("reads only .env.seed.local, never the environment", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-guard-"));
    process.env.SEED_LOCAL_DATABASE_URL = "postgres://postgres@127.0.0.1/ambient";
    expect(() => localTarget(dir)).toThrow(/\.env\.seed\.local not found/);
    writeFileSync(join(dir, ".env.seed.local"), "SEED_LOCAL_DATABASE_URL=postgres://postgres@127.0.0.1/from_file\n");
    expect(localTarget(dir).database).toBe("from_file");
    delete process.env.SEED_LOCAL_DATABASE_URL;
  });
});

describe("production target", () => {
  const ok = () => checkProduction(`https://${REF}.supabase.co`, KEY, REF, REF);

  it("accepts the exact project URL and its service key", () => {
    expect(ok().url).toBe(`https://${REF}.supabase.co`);
    expect(checkProduction(`https://${REF}.supabase.co/`, "sb_secret_abc", REF, REF).ref).toBe(REF);
  });

  it.each([
    ["a malformed ref", `https://${REF}.supabase.co`, KEY, "tekifezydjl", "tekifezydjl"],
    ["a confirmation that differs", `https://${REF}.supabase.co`, KEY, REF, "aaaaaaaaaaaaaaaaaaaa"],
    ["http", `http://${REF}.supabase.co`, KEY, REF, REF],
    ["credentials in the URL", `https://user:pass@${REF}.supabase.co`, KEY, REF, REF],
    ["a port", `https://${REF}.supabase.co:8443`, KEY, REF, REF],
    ["a path", `https://${REF}.supabase.co/rest/v1`, KEY, REF, REF],
    ["a query", `https://${REF}.supabase.co/?x=1`, KEY, REF, REF],
    ["another project", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", KEY, REF, REF],
    ["a lookalike host", `https://${REF}.supabase.co.evil.example`, KEY, REF, REF],
    ["a publishable key", `https://${REF}.supabase.co`, "sb_publishable_abc", REF, REF],
    ["an anon key", `https://${REF}.supabase.co`, jwt({ role: "anon", ref: REF }), REF, REF],
    ["another project's key", `https://${REF}.supabase.co`, jwt({ role: "service_role", ref: "aaaaaaaaaaaaaaaaaaaa" }), REF, REF],
    ["a key that is not a key", `https://${REF}.supabase.co`, "hunter2", REF, REF],
  ])("refuses %s", (_, url, key, ref, confirm) => {
    expect(() => checkProduction(url, key, ref, confirm)).toThrow(GuardError);
  });

  it("never puts the key in an error", () => {
    const secret = jwt({ role: "service_role", ref: "aaaaaaaaaaaaaaaaaaaa", marker: "do-not-print" });
    let message = "";
    try {
      checkProduction(`https://${REF}.supabase.co`, secret, REF, REF);
    } catch (e) {
      message = String((e as Error).message);
    }
    expect(message).toMatch(/different project/);
    expect(message).not.toContain(secret);
    expect(message).not.toContain("do-not-print");
  });

  it("reads only .env.seed.production, never the environment or .env.local", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-guard-"));
    process.env.SEED_SUPABASE_URL = `https://${REF}.supabase.co`;
    process.env.SEED_SUPABASE_SERVICE_ROLE_KEY = KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
    writeFileSync(join(dir, ".env.local"), `SEED_SUPABASE_URL=https://${REF}.supabase.co\nSEED_SUPABASE_SERVICE_ROLE_KEY=${KEY}\n`);
    expect(() => productionTarget(REF, REF, dir)).toThrow(/\.env\.seed\.production not found/);
    writeFileSync(join(dir, ".env.seed.production"), `SEED_SUPABASE_URL=https://${REF}.supabase.co\nSEED_SUPABASE_SERVICE_ROLE_KEY=${KEY}\n`);
    expect(productionTarget(REF, REF, dir).ref).toBe(REF);
    delete process.env.SEED_SUPABASE_URL;
    delete process.env.SEED_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("checks the ref before reading any file", () => {
    expect(() => productionTarget("nope", "nope", "/nonexistent")).toThrow(/20-letter/);
  });
});

describe("flags", () => {
  it("parses KEY=VALUE files strictly", () => {
    expect(parseEnvFile("# c\nA=1\nB='two'\n\n")).toEqual({ A: "1", B: "two" });
    expect(() => parseEnvFile("JUSTTEXT")).toThrow(GuardError);
  });
  it("refuses unknown flags", () => {
    expect(() => parseFlags(["--exeucte"], { values: [], booleans: ["execute"] })).toThrow(/unknown flag/);
  });
  it("refuses --real-judge, and --six-schools on production before the launch, with the reason", async () => {
    const before = await cliWith(undefined);
    expect(() => before.refuseUnsupported({ "six-schools": true }, "production")).toThrow(/only after the launch/);
    expect(() => before.refuseUnsupported({ "six-schools": true })).not.toThrow();
    expect(before.quizFlag({ "six-schools": true })).toBe(2);
    expect(before.quizFlag({})).toBeUndefined();
    expect(() => refuseUnsupported({ "real-judge": "10" })).toThrow(/disabled/);
  });
  it("refuses --six-schools with a plan, and on production a plan the scheduled job could not extend", async () => {
    expect(() => checkPlanQuiz({ "six-schools": true }, 2, "local")).toThrow(/not taken with --plan/);
    expect(() => checkPlanQuiz({}, 2, "local")).not.toThrow();
    expect(() => checkPlanQuiz({}, undefined, "local")).not.toThrow();
    // Before the launch the scheduled job names no quiz (RUN_QUIZ).
    const before = await cliWith(undefined);
    expect(() => before.checkPlanQuiz({}, undefined, "production")).not.toThrow();
    expect(() => before.checkPlanQuiz({}, 2, "production")).toThrow(/places samples by quiz v2.*every scheduled extension would refuse/);
  });
  it("after the launch merge sets RUN_QUIZ to 2: takes --six-schools on production, and there refuses a plan that names no quiz", async () => {
    const after = await cliWith(2);
    expect(() => after.refuseUnsupported({ "six-schools": true }, "production")).not.toThrow();
    expect(after.quizFlag({})).toBe(2);
    expect(() => after.checkPlanQuiz({}, 2, "production")).not.toThrow();
    expect(() => after.checkPlanQuiz({}, undefined, "production")).toThrow(/names no quiz.*every scheduled extension would refuse/);
    expect(() => after.checkPlanQuiz({ "six-schools": true }, 2, "production")).toThrow(/not taken with --plan/);
  });
});

// The command checks as they read RUN_QUIZ, set either way, so these tests
// hold before and after the launch merge sets it.
async function cliWith(runQuiz: 2 | undefined) {
  vi.resetModules();
  vi.doMock("../../scripts/seed/generate", async (importOriginal) => ({ ...(await importOriginal<object>()), RUN_QUIZ: runQuiz }));
  try {
    return await import("../../scripts/seed/cli");
  } finally {
    vi.doUnmock("../../scripts/seed/generate");
    vi.resetModules();
  }
}
