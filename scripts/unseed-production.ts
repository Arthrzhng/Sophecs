// Teardown of one production seed run. Preview by default; nothing is
// deleted without every one of:
//   --expected-project-ref <ref> --confirm-production <ref> --run-id <id>
//   --plan <file> --execute --confirm-teardown <id>
// matching each other, the plan and the target. Teardown is not part of
// any approval unless named in it explicitly (docs/sample-activity.md).

import { existsSync } from "node:fs";
import { productionTarget, describeTarget, GuardError } from "./seed/env";
import { SupabaseAdapter } from "./seed/adapter-supabase";
import { readPlan } from "./seed/plan";
import { preview, teardown } from "./seed/teardown";
import { compareBaselines } from "./seed/baseline";
import { log, main, parseFlags, str, writeReport } from "./seed/cli";

main(async () => {
  const f = parseFlags(process.argv.slice(2), {
    values: ["expected-project-ref", "confirm-production", "run-id", "plan", "confirm-teardown"],
    booleans: ["execute", "break-stale-lock"],
  });
  const ref = str(f, "expected-project-ref");
  const runId = str(f, "run-id");
  const planPath = str(f, "plan");
  if (!ref) throw new GuardError("--expected-project-ref is required");
  if (str(f, "confirm-production") !== ref) throw new GuardError("--confirm-production must repeat --expected-project-ref exactly");
  if (!runId) throw new GuardError("--run-id is required");
  if (!planPath || !existsSync(planPath)) throw new GuardError("--plan must name an existing plan file");
  const plan = readPlan(planPath);
  if (plan.target.kind !== "production" || plan.target.projectRef !== ref) throw new GuardError("the plan is not for this project");
  if (plan.runId !== runId) throw new GuardError(`--run-id ${runId} is not the plan's run ${plan.runId}`);
  if (f.execute && str(f, "confirm-teardown") !== runId) throw new GuardError("--confirm-teardown must repeat the run id exactly");

  const target = productionTarget(ref, str(f, "confirm-production"));
  const adapter = new SupabaseAdapter(target);
  log(`target: ${describeTarget(target)}`);
  const p = await preview(adapter, runId);
  log(`run ${runId}: ${p.status}`);
  for (const [k, v] of Object.entries(p.items)) log(`  ${k}: ${v.created} created, ${v.intended} intended, ${v.deleted} already deleted`);
  log(`intents never written: ${p.absent}; abandoned on a row the run did not write: ${p.foreign.length}`);
  for (const f of p.foreign) log(`  abandoned ${f.kind} ${f.rowId} (not touched)`);
  log(`genuine references to sample rows: ${p.entanglements.length} (${p.blocking.length} that teardown cannot keep)`);
  for (const e of p.entanglements) log(`  ${e.nullable ? "clear" : "STOP "} ${e.table}.${e.column} ${e.rowId} -> ${e.pointsAt}`);
  if (!f.execute) {
    log("preview only; nothing deleted.");
    return;
  }
  const r = await teardown(adapter, runId, { log, breakStaleLock: Boolean(f["break-stale-lock"]) });
  const checks = compareBaselines(r.before, r.after);
  for (const c of checks) log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}`);
  log(`report: ${writeReport(`unseed-${runId}`, { ...r, checks })}`);
  if (!checks.every((c) => c.ok)) process.exitCode = 1;
});
