// Sample activity against a Postgres on this machine, for testing the whole
// path before production. The database is named in .env.seed.local and is
// the tool's own: --create-db refuses if it already exists, and --drop-db
// drops only a database --create-db made.
//
//   npm run seed:local -- --create-db
//   npm run seed:local -- --make-plan [--seed N] [--to ISO] [--users N] [--out FILE]
//   npm run seed:local -- --run-id <id> --plan <file>              dry run
//   npm run seed:local -- --run-id <id> --plan <file> --execute [--canary K]
//   npm run seed:local -- --run-id <id> --plan <file> --validate
//   npm run seed:local -- --drop-db

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { localTarget, describeTarget, GuardError } from "./seed/env";
import { LocalAdapter } from "./seed/adapter-local";
import { buildPlan, readPlan, writePlan, datasetForPlan } from "./seed/plan";
import { DEFAULTS } from "./seed/generate";
import { contentTopics } from "./seed/topics";
import { execute } from "./seed/engine";
import { validate } from "./seed/validate";
import { dryRun } from "./seed/dryrun";
import { getAllTopicFiles } from "../src/lib/topics";
import { REPORT_DIR, cancelSignal, int, isoFlag, log, main, nowFloored, parseFlags, refuseUnsupported, str, writeReport } from "./seed/cli";

const MARKER = "sophecs seed-local: disposable database made by scripts/seed-local.ts --create-db";

main(async () => {
  const f = parseFlags(process.argv.slice(2), {
    values: ["run-id", "plan", "seed", "from", "base-to", "to", "users", "anon-results", "challenges", "exchanges", "classes", "canary", "out", "real-judge", "batch-size"],
    booleans: ["execute", "validate", "create-db", "drop-db", "make-plan", "six-schools", "break-stale-lock"],
  });
  refuseUnsupported(f);
  // The host check happens here, before psql is ever started.
  const target = localTarget();
  log(`target: ${describeTarget(target)}`);
  const admin = new LocalAdapter(target, "postgres");
  const db = new LocalAdapter(target);
  const exists = () => admin.sql(`select 1 from pg_database where datname = '${target.database}';`).trim() === "1";
  const comment = () =>
    admin.sql(`select coalesce(shobj_description(oid, 'pg_database'), '') from pg_database where datname = '${target.database}';`).trim();

  if (f["create-db"]) {
    if (exists()) throw new GuardError(`database ${target.database} already exists; this tool only seeds a database it created`);
    admin.sql(`create database "${target.database}";`);
    admin.sql(`comment on database "${target.database}" is '${MARKER}';`);
    db.sql(readFileSync(join("scripts", "local-auth-shim.sql"), "utf8"));
    for (const file of readdirSync(join("supabase", "migrations")).filter((x) => x.endsWith(".sql")).sort())
      db.sql(`begin;\n${readFileSync(join("supabase", "migrations", file), "utf8")}\ncommit;`);
    for (const t of getAllTopicFiles())
      db.sql(
        `insert into public.debate_topics (slug, title, motion, stances, micro_before, micro_after, sort, active)
         select slug, title, motion, stances, micro_before, micro_after, sort, active
         from json_populate_record(null::public.debate_topics, $seedjson$${JSON.stringify(t)}$seedjson$);`
      );
    log(`created ${target.database}: shim, every migration, ${getAllTopicFiles().length} topics`);
    return;
  }
  if (f["drop-db"]) {
    if (!exists()) throw new GuardError(`database ${target.database} does not exist`);
    if (comment() !== MARKER) throw new GuardError(`${target.database} was not made by --create-db; not dropping it`);
    admin.sql(`drop database "${target.database}";`);
    log(`dropped ${target.database}`);
    return;
  }
  if (f["make-plan"]) {
    const baseTo = isoFlag(f, "base-to", nowFloored());
    const to = isoFlag(f, "to", baseTo);
    const seed = str(f, "seed") ?? "20261104";
    const out = str(f, "out") ?? join(REPORT_DIR, `sample-${baseTo.replace(/[-:T]/g, "").slice(0, 12)}.local-plan.json`);
    const { plan } = buildPlan({
      target: { kind: "local", database: target.database },
      planPath: out,
      gen: {
        seed,
        from: isoFlag(f, "from", DEFAULTS.from),
        baseTo,
        to,
        users: int(f, "users", DEFAULTS.users, 1, 20000),
        anonResults: int(f, "anon-results", DEFAULTS.anonResults, 0, 50000),
        challenges: int(f, "challenges", DEFAULTS.challenges, 0, 5000),
        exchanges: int(f, "exchanges", DEFAULTS.exchanges, 0, 5000),
        classes: int(f, "classes", DEFAULTS.classes, 0, 100),
        topics: contentTopics(),
      },
    });
    writePlan(out, plan);
    log(`plan ${plan.runId} written to ${out}`);
    return;
  }

  const planPath = str(f, "plan");
  const runId = str(f, "run-id");
  if (!planPath || !existsSync(planPath)) throw new GuardError("--plan must name an existing plan file");
  const plan = readPlan(planPath);
  if (plan.target.kind !== "local" || plan.target.database !== target.database)
    throw new GuardError(`the plan is not for local database ${target.database}`);
  if (plan.runId !== runId) throw new GuardError(`--run-id ${runId} is not the plan's run ${plan.runId}`);
  if (comment() !== MARKER) throw new GuardError(`${target.database} was not made by --create-db; refusing to seed it`);
  const dataset = datasetForPlan(plan, contentTopics());
  log(`offline: manifest matches (${plan.manifestHash})`);
  const cohortLimit = str(f, "canary") ? int(f, "canary", 0, 1, plan.counts.auth_user) : undefined;

  if (f.validate) {
    const report = await validate(db, dataset, null, { cohortLimit });
    for (const c of report.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (!f.execute) {
    const report = await dryRun(db, plan);
    for (const line of report.lines) log(line);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  const result = await execute({ dataset, plan, adapter: db, cohortLimit, batchSize: int(f, "batch-size", 500, 1, 2000), log, signal: cancelSignal(log), breakStaleLock: Boolean(f["break-stale-lock"]) });
  log(`wrote ${JSON.stringify(result.written)} in ${result.seconds.toFixed(1)} s (${result.rowsPerSecond.toFixed(0)} rows/s)`);
  const report = await validate(db, dataset, result.before, { cohortLimit });
  for (const c of report.checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
  log(`report: ${writeReport(`seed-local-${plan.runId}`, { result, validation: report })}`);
  if (!report.ok) process.exitCode = 1;
});
