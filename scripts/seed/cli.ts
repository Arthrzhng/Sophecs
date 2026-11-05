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
export function refuseUnsupported(f: Flags) {
  if (f["six-schools"])
    throw new GuardError(
      "--six-schools is not supported: the published quiz (content/quiz/questions.ts) scores three schools, and the six-school quiz (docs/quiz-v2.md) is a draft that is not built. Sample results can only come from the quiz readers actually take."
    );
  if (f["real-judge"] !== undefined)
    throw new GuardError(
      "--real-judge is disabled. The real judging pipeline is /api/judge, which needs a signed-in session, and sample accounts cannot sign in by design. Calling the judge library directly would skip the route's daily cap, kill switch and budget checks and write ai_calls rows for accounts that never made a request. Enabling it needs: a decision on that path (it changes what is billed, so it is Arthur's under (d)), a selection rule, and a cap of 50. Until then every sample verdict is a template, labelled as one."
    );
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
