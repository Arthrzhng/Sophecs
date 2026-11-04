// Sample activity for production. docs/sample-activity.md has the design
// and the rollout; the short version:
//
//   plan     npm run seed:plan -- --expected-project-ref <ref> [--seed N] [--from ISO] [--to ISO]
//            Writes docs/seed-plans/<run-id>.json. No network, no writes.
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

import { productionTarget, describeTarget, GuardError } from "./seed/env";
import { SupabaseAdapter } from "./seed/adapter-supabase";
import { buildPlan, readPlan, writePlan, datasetForPlan } from "./seed/plan";
import { DEFAULTS } from "./seed/generate";
import { contentTopics } from "./seed/topics";
import { execute } from "./seed/engine";
import { validate } from "./seed/validate";
import { snapshot } from "./seed/baseline";
import { cancelSignal, int, isoFlag, log, main, nowFloored, parseFlags, refuseUnsupported, str, writeReport } from "./seed/cli";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [command, ...rest] = process.argv.slice(2);
const isPlan = command === "plan";
const argv = isPlan ? rest : process.argv.slice(2);

main(async () => {
  const f = parseFlags(argv, {
    values: ["expected-project-ref", "confirm-production", "run-id", "plan", "seed", "from", "to", "users", "anon-results", "challenges", "exchanges", "classes", "canary", "out", "real-judge", "concurrency", "batch-size", "rows-per-second", "auth-per-second"],
    booleans: ["execute", "validate", "six-schools"],
  });
  refuseUnsupported(f);
  const ref = str(f, "expected-project-ref");

  if (isPlan) {
    if (!ref || !/^[a-z]{20}$/.test(ref)) throw new GuardError("--expected-project-ref must be a 20-letter project ref");
    const to = isoFlag(f, "to", nowFloored());
    const gen = {
      seed: int(f, "seed", 20261104, 0, 2 ** 31 - 1),
      from: isoFlag(f, "from", DEFAULTS.from),
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
    const runIdGuess = `sample-${gen.seed}-${to.replace(/[-:T]/g, "").slice(0, 12)}`;
    const out = str(f, "out") ?? join("docs", "seed-plans", `${runIdGuess}.json`);
    const { plan } = buildPlan({ target: { kind: "production", projectRef: ref }, gen, planPath: out, measured });
    writePlan(out, plan);
    log(`plan ${plan.runId} written to ${out}`);
    log(`manifest ${plan.manifestHash}`);
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
    await adapter.checkSchema();
    const base = await snapshot(adapter);
    const runs = await adapter.listRuns();
    const run = runs.find((r) => r.id === plan.runId);
    log(`dry run, reads only. Schema has migration 0021. Genuine rows: ${JSON.stringify(base.genuine)}`);
    log(`runs on target: ${runs.map((r) => `${r.id} ${r.status}${r.lock_token ? " (locked)" : ""}`).join(", ") || "none"}`);
    log(run ? `this run exists: ${run.status}` : "this run has not started");
    for (const t of plan.topics) {
      const live = base.topics.find((x) => x.slug === t.slug);
      log(`  ${t.slug}: ${live && live.active && live.motion === t.motion ? "motion matches" : "DIFFERS: make a new plan"}`);
    }
    log("nothing written. Add --execute to run it.");
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
  });
  log(`wrote ${JSON.stringify(result.written)} in ${result.seconds.toFixed(1)} s (${result.rowsPerSecond.toFixed(0)} rows/s${result.authUsersPerSecond ? `, ${result.authUsersPerSecond.toFixed(1)} auth users/s` : ""})`);
  if (result.cancelled) {
    log("cancelled. Run the same command to resume.");
    return;
  }
  const report = await validate(adapter, dataset, result.before, { cohortLimit });
  for (const c of report.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
  log(`report: ${writeReport(`seed-${plan.runId}`, { result, validation: report })}`);
  if (!report.ok) {
    log("validation failed: stop here. See docs/sample-activity.md, \"Stop conditions\".");
    process.exitCode = 1;
  }
});
