// Shared command-line handling for the seed entry points. Nothing in this
// directory runs on its own: no build step, install hook, migration or
// route imports it, there is no HTTP endpoint for it, and the one workflow
// that runs it, .github/workflows/sample-activity.yml, runs only on its
// schedule or by hand, never on a push or a pull request
// (tests/seed/isolation.test.ts checks all of that).

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { GuardError } from "./env";
import { StopError } from "./engine";
import { RUN_QUIZ, RUN_WEEKLY, type GenConfig } from "./generate";

export const REPORT_DIR = join(process.cwd(), "scripts", "seed", "reports");

export type Flags = Record<string, string | true>;

export function parseFlags(argv: string[], allowed: { values: string[]; booleans: string[] }): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new GuardError(`unexpected argument ${a}`);
    const name = a.slice(2);
    if (allowed.booleans.includes(name)) out[name] = true;
    else if (allowed.values.includes(name)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new GuardError(`--${name} needs a value`);
      out[name] = v;
    } else throw new GuardError(`unknown flag --${name}`);
  }
  return out;
}

export const str = (f: Flags, k: string): string | undefined => (typeof f[k] === "string" ? (f[k] as string) : undefined);

export function int(f: Flags, k: string, fallback: number, min = 0, max = 1_000_000): number {
  const v = str(f, k);
  if (v === undefined) return fallback;
  if (!/^\d+$/.test(v)) throw new GuardError(`--${k} must be a whole number`);
  const n = Number(v);
  if (n < min || n > max) throw new GuardError(`--${k} must be between ${min} and ${max}`);
  return n;
}

export function isoFlag(f: Flags, k: string, fallback: string): string {
  const v = str(f, k) ?? fallback;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new GuardError(`--${k} is not a date`);
  return new Date(t).toISOString();
}

/** Minutes, floored: the window's end is frozen at plan time. */
export function nowFloored(): string {
  const t = Math.floor(Date.now() / 60_000) * 60_000;
  return new Date(t).toISOString();
}

/** Options the brief names that this build cannot honour, refused with the reason. */
export function refuseUnsupported(f: Flags, target: "local" | "production" = "local") {
  // Quiz v2 is built, behind SIX_SCHOOLS, and the launch ships it (Gate 4
  // item 13). Production shows three schools until then, and a sample placed
  // in another would reach pages that cannot show it.
  if (f["six-schools"] && target === "production" && RUN_QUIZ !== 2)
    throw new GuardError(
      "--six-schools is for production only after the launch: the launch merge sets RUN_QUIZ to 2 (scripts/seed/generate.ts), after the sample teardown. Until then production shows three schools and readers take quiz v1, and a sample placed by quiz v2 could land in a school its pages cannot show."
    );
  if (f["real-judge"] !== undefined)
    throw new GuardError(
      "--real-judge is disabled. The real judging pipeline is /api/judge, which needs a signed-in session, and sample accounts cannot sign in by design. Calling the judge library directly would skip the route's daily cap, kill switch and budget checks and write ai_calls rows for accounts that never made a request. Enabling it needs: a decision on that path (it changes what is billed, so it is Arthur's under (d)), a selection rule, and a cap of 50. Until then every sample verdict is a template, labelled as one."
    );
}

/**
 * For a command given a plan. --six-schools only makes a plan, since a plan
 * names its own quiz, so it is refused with --plan rather than ignored.
 * And production refuses a plan whose quiz is not the scheduled job's
 * (RUN_QUIZ): every scheduled extension of that run would be refused.
 */
export function checkPlanQuiz(f: Flags, planQuiz: GenConfig["quiz"], target: "local" | "production"): void {
  if (f["six-schools"]) throw new GuardError("--six-schools makes a plan with quiz v2; a plan names its own quiz, so it is not taken with --plan");
  if (target === "production" && (planQuiz ?? undefined) !== RUN_QUIZ)
    throw new GuardError(
      `the plan ${planQuiz ? "places samples by quiz v2" : "names no quiz"}, but the scheduled job's runs ${RUN_QUIZ ? "place them by quiz v2" : "name none"} (RUN_QUIZ in scripts/seed/generate.ts), so every scheduled extension would refuse this run`
    );
}

/**
 * And a plan's weekly shape (`weekly`) must be the scheduled job's
 * (RUN_WEEKLY), for the same reason: it is part of the base hash.
 */
export function checkPlanWeekly(planWeekly: GenConfig["weekly"], planQuiz: GenConfig["quiz"], target: "local" | "production"): void {
  // The shape the scheduled job gives a plan of this quiz: RUN_WEEKLY for
  // quiz v2, none for a plan that names no quiz (ci.ts, weeklyFor).
  const expected = weeklyFor(planQuiz).weekly;
  if (target === "production" && JSON.stringify(planWeekly ?? null) !== JSON.stringify(expected ?? null))
    throw new GuardError("the plan's weekly shape is not the scheduled job's (RUN_WEEKLY in scripts/seed/generate.ts), so every scheduled extension would refuse this run");
}

/** The weekly shape a quiz v2 run grows by: the scheduled job's. */
export function weeklyFor(quiz: GenConfig["quiz"]): Pick<GenConfig, "weekly"> {
  return quiz === 2 && RUN_WEEKLY ? { weekly: RUN_WEEKLY } : {};
}

/** The quiz a run places samples by: quiz v2 and six schools with --six-schools, else what the scheduled job uses. */
export function quizFlag(f: Flags): GenConfig["quiz"] {
  return f["six-schools"] ? 2 : RUN_QUIZ;
}

// Readers' data stays in Supabase (Arthur, 2026-11-04). A baseline holds
// counts and each topic's par window (ratings, no ids) and nothing per
// reader, and a report on disk still leaves the baselines out.
const GENUINE_KEYS = new Set(["baseline", "before", "after"]);

export function writeReport(name: string, body: unknown): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = join(REPORT_DIR, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify(body, (k, v) => (GENUINE_KEYS.has(k) ? undefined : v), 2) + "\n");
  return path;
}

/** Ctrl-C once: finish the batch and stop cleanly. Twice: exit now. */
export function cancelSignal(log: (s: string) => void): AbortSignal {
  const ac = new AbortController();
  let pressed = 0;
  process.on("SIGINT", () => {
    pressed++;
    if (pressed === 1) {
      log("cancelling after the current batch; the same command resumes. Ctrl-C again to exit now.");
      ac.abort();
    } else process.exit(130);
  });
  return ac.signal;
}

export async function main(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof GuardError || err instanceof StopError) {
      console.error(`refused: ${err.message}`);
      process.exit(2);
    }
    console.error(`failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

export const log = (s: string) => console.log(s);
