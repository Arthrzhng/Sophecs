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
  it("elo_percentile counts genuine profiles only (migration 0023, redefined by 0024)", () => {
    const sql = readFileSync("supabase/migrations/0023_sample_activity.sql", "utf8");
    expect(sql).toMatch(/from profiles where not is_sample and elo < user_elo/);
    // 0024 is the definition that stands: the same filter, every time the
    // table is counted.
    const now = readFileSync("supabase/migrations/0024_checkpoint_a_database.sql", "utf8");
    const body = now.slice(now.indexOf("create or replace function public.elo_percentile"), now.indexOf("$$;", now.indexOf("create or replace function public.elo_percentile")));
    expect(body.match(/from public\.profiles where not is_sample/g)).toHaveLength(3);
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
  it("runs from one workflow only, on its schedule or by hand, never on a push or a pull request", () => {
    // Arthur's ruling of 2026-11-04 puts the seed in a scheduled workflow;
    // no other workflow may touch it, and this one may not run on events
    // a fork or a branch can cause, which is how secrets reach strangers.
    const dir = ".github/workflows";
    const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    for (const f of workflows.filter((x) => x !== "sample-activity.yml")) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/seed/i);
    const wf = readFileSync(join(dir, "sample-activity.yml"), "utf8");
    const on = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"));
    expect(on).toMatch(/schedule:/);
    expect(on).toMatch(/workflow_dispatch:/);
    expect(on).not.toMatch(/\b(push|pull_request|pull_request_target|workflow_run|issue_comment|release)\b/);
    expect(wf).toMatch(/github\.ref == 'refs\/heads\/main'/);
    expect(wf).toMatch(/npm run -s seed:ci -- --mode "\$MODE"/);
    // Secrets go into the credentials file only, never onto a command line
    // or into an echo, and the file is removed whatever happened.
    expect(wf).not.toMatch(/echo[^\n]*secrets\./);
    expect(wf.match(/\$\{\{ secrets\./g)).toHaveLength(2);
    // The secrets live in an environment limited to main, not in the
    // repository, where any branch's workflow could read them.
    expect(wf).toMatch(/^ {4}environment: sample-activity$/m);
    expect(wf).toMatch(/if: always\(\)\n\s*run: rm -f \.env\.seed\.production/);
    expect(wf).toMatch(/persist-credentials: false/);
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
