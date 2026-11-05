// Sample activity for production. docs/sample-activity.md has the design
// and the rollout; the short version:
//
//   plan     npm run seed:plan -- --expected-project-ref <ref> --seed N [--from ISO] [--to ISO]
//            or npm run seed:production -- --dry-run --expected-project-ref <ref> --seed N
//            Writes scripts/seed/reports/plans/<run-id>.json, which is git-ignored:
//            a production plan names every row id the run will write, so it is
//            kept off the public repository. No network, no writes.
//   dry run  npm run seed:production -- --expected-project-ref <ref> --confirm-production <ref>
//              --run-id <id> --plan <file>
//            Regenerates the plan's rows and checks them against its hash. With
//            .env.seed.production present it also reads the target (schema, motions,
//            locks, baseline). Writes nothing.
//   execute  the same, plus --execute [--canary K]
//   validate the same, plus --validate (reads only)
//
// Every mismatch between the flags, the plan, the credentials and the
// target refuses before the first write.

import { productionTarget, productionSeed, describeTarget, GuardError } from "./seed/env";
import { SupabaseAdapter } from "./seed/adapter-supabase";
import { buildPlan, readPlan, writePlan, datasetForPlan } from "./seed/plan";
import { DEFAULTS } from "./seed/generate";
import { contentTopics } from "./seed/topics";
import { execute, finishValidation, VALIDATING } from "./seed/engine";
import { validate } from "./seed/validate";
import { dryRun } from "./seed/dryrun";
import { cancelSignal, int, isoFlag, log, main, nowFloored, parseFlags, refuseUnsupported, str, writeReport } from "./seed/cli";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [command, ...rest] = process.argv.slice(2);
const argv = command === "plan" ? rest : process.argv.slice(2);

main(async () => {
  const f = parseFlags(argv, {
    values: ["expected-project-ref", "confirm-production", "run-id", "plan", "seed", "from", "base-to", "to", "users", "anon-results", "challenges", "exchanges", "classes", "canary", "out", "real-judge", "concurrency", "batch-size", "rows-per-second", "auth-per-second"],
    booleans: ["execute", "validate", "six-schools", "break-stale-lock", "dry-run"],
  });
  refuseUnsupported(f);
  const ref = str(f, "expected-project-ref");
  if (f["dry-run"] && (f.execute || f.validate)) throw new GuardError("--dry-run cannot be combined with --execute or --validate");
  // A dry run with no plan makes the plan: nothing but the plan file is written.
  const isPlan = command === "plan" || (Boolean(f["dry-run"]) && !str(f, "plan"));

  if (isPlan) {
    if (!ref || !/^[a-z]{20}$/.test(ref)) throw new GuardError("--expected-project-ref must be a 20-letter project ref");
    // The seed comes from the credentials file, never a flag: with a
    // public generator it fixes every id the run will write, and a flag
    // would leave it in shell history.
    if (str(f, "seed")) throw new GuardError("--seed is not taken for production; put SEED_PLAN_SEED in .env.seed.production");
    const baseTo = isoFlag(f, "base-to", nowFloored());
    const to = isoFlag(f, "to", baseTo);
    const gen = {
      seed: productionSeed(),
      from: isoFlag(f, "from", DEFAULTS.from),
      baseTo,
      to,
      users: int(f, "users", DEFAULTS.users, 1, 20000),
      anonResults: int(f, "anon-results", DEFAULTS.anonResults, 0, 50000),
      challenges: int(f, "challenges", DEFAULTS.challenges, 0, 5000),
      exchanges: int(f, "exchanges", DEFAULTS.exchanges, 0, 5000),
      classes: int(f, "classes", DEFAULTS.classes, 0, 100),
      topics: contentTopics(),
    };
    const measured = str(f, "rows-per-second")
      ? { rowsPerSecond: Number(str(f, "rows-per-second")), authUsersPerSecond: Number(str(f, "auth-per-second") ?? 4), source: "given on the command line" }
      : undefined;
    const runIdGuess = `sample-${baseTo.replace(/[-:T]/g, "").slice(0, 12)}`;
    const out = str(f, "out") ?? join("scripts", "seed", "reports", "plans", `${runIdGuess}.json`);
    const { plan } = buildPlan({ target: { kind: "production", projectRef: ref }, gen, planPath: out, measured });
    writePlan(out, plan);
    log(`plan ${plan.runId} written to ${out}`);
    log(JSON.stringify(plan.counts));
    return;
  }

  // Everything below needs the full set of flags, matching each other and the plan.
  const planPath = str(f, "plan");
  const runId = str(f, "run-id");
  if (!planPath || !existsSync(planPath)) throw new GuardError("--plan must name an existing plan file");
  if (!runId) throw new GuardError("--run-id is required");
  if (!ref) throw new GuardError("--expected-project-ref is required");
  if (str(f, "confirm-production") !== ref) throw new GuardError("--confirm-production must repeat --expected-project-ref exactly");
  const plan = readPlan(planPath);
  if (plan.target.kind !== "production" || plan.target.projectRef !== ref)
    throw new GuardError(`the plan is for ${plan.target.kind === "production" ? plan.target.projectRef : "a local target"}, not ${ref}`);
  if (plan.runId !== runId) throw new GuardError(`--run-id ${runId} is not the plan's run ${plan.runId}`);
  if (f.execute && f.validate) throw new GuardError("--execute and --validate are separate steps");

  log(`offline: regenerating ${plan.runId} from the plan`);
  const dataset = datasetForPlan(plan, contentTopics());
  log(`offline: manifest matches (${plan.manifestHash})`);

  // Credentials are read only now, and checked before any request.
  const target = productionTarget(ref, str(f, "confirm-production"));
  const adapter = new SupabaseAdapter(target);
  log(`target: ${describeTarget(target)}`);

  if (!f.execute && !f.validate) {
    const report = await dryRun(adapter, plan);
    for (const line of report.lines) log(line);
    log(`baseline: ${writeReport(`dryrun-${plan.runId}`, report)}`);
    if (!report.ok) process.exitCode = 1;
    else log("Add --execute to run it.");
    return;
  }

  const cohortLimit = str(f, "canary") ? int(f, "canary", 0, 1, plan.counts.auth_user) : undefined;
  if (f.validate) {
    const report = await validate(adapter, dataset, null, { cohortLimit });
    for (const c of report.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
    log(`report: ${writeReport(`validate-${plan.runId}`, report)}`);
    if (!report.ok) process.exitCode = 1;
    return;
  }

  const result = await execute({
    dataset,
    plan,
    adapter,
    cohortLimit,
    batchSize: int(f, "batch-size", 250, 1, 1000),
    authConcurrency: int(f, "concurrency", 4, 1, 8),
    log,
    signal: cancelSignal(log),
    breakStaleLock: Boolean(f["break-stale-lock"]),
    // Halted until the validation below passes, as the scheduled job does
    // (scripts/seed/ci.ts), so a run by hand cannot lift a halt unvalidated.
    endHalted: VALIDATING,
  });
  log(`wrote ${JSON.stringify(result.written)} in ${result.seconds.toFixed(1)} s (${result.rowsPerSecond.toFixed(0)} rows/s${result.authUsersPerSecond ? `, ${result.authUsersPerSecond.toFixed(1)} auth users/s` : ""})`);
  if (result.cancelled) {
    log("cancelled. Run the same command to resume; the run stays halted until a run of it passes validation.");
    return;
  }
  const report = await validate(adapter, dataset, result.before, { cohortLimit });
  for (const c of report.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
  log(`report: ${writeReport(`seed-${plan.runId}`, { result, validation: report })}`);
  if (!(await finishValidation(adapter, result, report.checks.filter((c) => !c.ok).map((c) => c.name))))
    log("the run changed while it was validated (another process or a teardown); it is left as that left it");
  if (!report.ok) {
    log("validation failed: stop here. See docs/sample-activity.md, \"Stop conditions\".");
    process.exitCode = 1;
  }
});
