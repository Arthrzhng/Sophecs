import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLocalUrl, checkProduction, localTarget, parseEnvFile, productionTarget, GuardError } from "../../scripts/seed/env";
import { parseFlags, refuseUnsupported } from "../../scripts/seed/cli";

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
    try {
      checkProduction(`https://${REF}.supabase.co`, secret, REF, REF);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(secret);
      expect(String((e as Error).message)).not.toContain("do-not-print");
    }
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
  it("refuses --six-schools and --real-judge with the reason", () => {
    expect(() => refuseUnsupported({ "six-schools": true })).toThrow(/scores three schools/);
    expect(() => refuseUnsupported({ "real-judge": "10" })).toThrow(/disabled/);
  });
});
