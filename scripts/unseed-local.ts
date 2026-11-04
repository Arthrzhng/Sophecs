// Teardown of one local seed run: preview by default, and --execute
// --confirm-teardown <run-id> to delete. See scripts/seed-local.ts.
import { existsSync } from "node:fs";
import { localTarget, describeTarget, GuardError } from "./seed/env";
import { LocalAdapter } from "./seed/adapter-local";
import { readPlan } from "./seed/plan";
import { preview, teardown } from "./seed/teardown";
import { compareBaselines } from "./seed/baseline";
import { log, main, parseFlags, str } from "./seed/cli";

main(async () => {
  const f = parseFlags(process.argv.slice(2), { values: ["run-id", "plan", "confirm-teardown"], booleans: ["execute", "break-stale-lock"] });
  const target = localTarget();
  const runId = str(f, "run-id");
  const planPath = str(f, "plan");
  if (!planPath || !existsSync(planPath)) throw new GuardError("--plan must name an existing plan file");
  const plan = readPlan(planPath);
  if (plan.target.kind !== "local" || plan.target.database !== target.database) throw new GuardError("the plan is not for this local database");
  if (!runId || plan.runId !== runId) throw new GuardError("--run-id must be the plan's run id");
  if (f.execute && str(f, "confirm-teardown") !== runId) throw new GuardError("--confirm-teardown must repeat the run id exactly");
  const adapter = new LocalAdapter(target);
  log(`target: ${describeTarget(target)}`);
  const p = await preview(adapter, runId);
  for (const [k, v] of Object.entries(p.items)) log(`  ${k}: ${v.created} created, ${v.intended} intended, ${v.deleted} deleted`);
  log(`genuine references to sample rows: ${p.entanglements.length} (${p.blocking.length} blocking)`);
  for (const e of p.entanglements) log(`  ${e.nullable ? "clear" : "STOP "} ${e.table}.${e.column} ${e.rowId} -> ${e.pointsAt}`);
  if (!f.execute) {
    log("preview only; nothing deleted.");
    return;
  }
  const r = await teardown(adapter, runId, { log, breakStaleLock: Boolean(f["break-stale-lock"]) });
  for (const c of compareBaselines(r.before, r.after)) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
});
