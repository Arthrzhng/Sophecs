// Where sample data must not reach, checked in the source: the judge's par,
// challenge ratings, the build, install and deploy hooks, the HTTP surface,
// and the browser.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("sample activity stays out of genuine calibration", () => {
  it("/api/judge leaves sample debates out of the par window", () => {
    const src = readFileSync("src/app/api/judge/route.ts", "utf8");
    const window = src.slice(src.indexOf('.select("elo_before")'), src.indexOf(".limit(PAR_ELO_WINDOW)"));
    expect(window).toContain('.eq("is_sample", false)');
    expect(window).toContain('.eq("kind", "original")');
  });
  it("a challenge with a sample side moves no rating", () => {
    const src = readFileSync("src/lib/challenge.ts", "utf8");
    expect(src).toMatch(/if \(challengerDebate\.is_sample \|\| challengeeDebate\.is_sample\) return \{ completed: false \};/);
    expect(src.indexOf("is_sample) return")).toBeLessThan(src.indexOf("pairwiseElo(\n"));
  });
  it("elo_percentile counts genuine profiles only (migration 0021)", () => {
    const sql = readFileSync("supabase/migrations/0021_sample_activity.sql", "utf8");
    expect(sql).toMatch(/from profiles where not is_sample and elo < user_elo/);
  });
});

describe("the seed never runs by itself", () => {
  it("no app, API or library file imports it", () => {
    for (const f of files("src"))
      expect(readFileSync(f, "utf8"), f).not.toMatch(/(from|import|require\()\s*\(?["'][^"']*(scripts\/seed|seed-production|seed-local|unseed)/);
  });
  it("no lifecycle script, deploy config or workflow runs it", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    for (const [name, cmd] of Object.entries(pkg.scripts))
      if (!/^(un)?seed:|^test:seed-db$/.test(name)) expect(cmd, name).not.toMatch(/seed-production|seed-local|unseed|scripts\/seed\//);
    for (const hook of ["preinstall", "install", "postinstall", "prepare", "prebuild", "postbuild", "predev", "prestart"]) expect(pkg.scripts[hook]).toBeUndefined();
    expect(readFileSync("vercel.json", "utf8")).not.toMatch(/seed/);
    expect(readFileSync("next.config.ts", "utf8")).not.toMatch(/seed/);
  });
  it("has no HTTP endpoint", () => {
    for (const f of files("src/app").filter((x) => /route\.tsx?$/.test(x))) expect(readFileSync(f, "utf8"), f).not.toMatch(/seed_run|is_sample.*true/);
  });
  it("reads credentials from its own files only, and never a public variable", () => {
    const env = readFileSync("scripts/seed/env.ts", "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(env).not.toContain("process.env");
    for (const f of files("scripts/seed").filter((x) => x.endsWith(".ts"))) expect(readFileSync(f, "utf8"), f).not.toContain("NEXT_PUBLIC");
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain(".env.seed.production");
    expect(ignore).toContain(".env.seed.local");
  });
});
