import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { ALL_SCHOOL_IDS } from "../src/lib/school-registry.drafts";

/**
 * The school lists inside the migrations agree with the registry.
 *
 * `docs/phase2-recon.md` noted that the CHECK constraints were the one set
 * of school enumerations no test could see: the registry guard reads
 * TypeScript, and these are SQL. Phase 2C is where they stop agreeing by
 * coincidence, so this is where they start being checked.
 *
 * The migrations are read in filename order and a later definition of the
 * same constraint replaces an earlier one, which is how the database
 * itself ends up: 0001 writes `quiz_results_school_check` with three
 * schools and 0014 replaces it with six. Only the last one is live, so
 * only the last one is compared.
 */

const DIR = path.join(process.cwd(), "supabase", "migrations");

/** `check (school in ('a','b'))`, wherever it appears. */
const CHECK = /add\s+constraint\s+(\w+)\s+check\s*\(\s*(\w+)\s+in\s*\(([^)]*)\)/gi;

function liveSchoolChecks(): Map<string, string[]> {
  const live = new Map<string, string[]>();
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(DIR, file), "utf-8");
    for (const match of sql.matchAll(CHECK)) {
      const [, name, , list] = match;
      const values = [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      // Only the school constraints: a status or kind CHECK is not one.
      if (!values.includes("stoicism")) continue;
      live.set(name, values);
    }
  }
  return live;
}

describe("the school lists in supabase/migrations", () => {
  const live = liveSchoolChecks();

  it("finds the constraints at all", () => {
    expect([...live.keys()].sort()).toEqual([
      "debates_school_check",
      "exchanges_school_a_check",
      "exchanges_school_b_check",
      "profiles_school_check",
      "quiz_results_school_check",
      "quiz_results_secondary_check",
    ]);
  });

  it.each([...liveSchoolChecks().keys()].sort())(
    "%s lists exactly the registry's schools",
    (name) => {
      const values = liveSchoolChecks().get(name);
      expect(values, name).toBeDefined();
      expect([...(values ?? [])].sort()).toEqual([...ALL_SCHOOL_IDS].sort());
    }
  );

  it("has no duplicate school in any list", () => {
    for (const [name, values] of live) {
      expect(new Set(values).size, `${name} repeats a school`).toBe(values.length);
    }
  });

  it("keeps a rollback for every migration that changes one", () => {
    // 0014 is the migration that moved these; a constraint change without
    // a tested way back is what supabase/rollback exists to prevent.
    const rollbacks = fs.readdirSync(path.join(process.cwd(), "supabase", "rollback"));
    expect(rollbacks).toContain("0014_more_schools.down.sql");
    expect(rollbacks).toContain("0015_debates_motion_text.down.sql");
  });
});
