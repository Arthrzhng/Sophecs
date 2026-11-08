// Checks after a run, all reads. Each check says what it compared, so a
// failure can be read without rerunning anything.

import type { Adapter, Kind, Table } from "./adapter";
import type { Dataset } from "./generate";
import { phases } from "./engine";
import { settledChecks, compareBaselines, isolationChecks, type Baseline, type BaselineCheck } from "./baseline";
import { Rng } from "./rng";
import { roundScoreCheck, storedScoreCheck } from "./round-scores";

export interface ValidationReport {
  ok: boolean;
  checks: BaselineCheck[];
  after: Baseline;
}

const SPOT_COLUMNS: Partial<Record<Table, string[]>> = {
  profiles: ["id", "handle", "school", "elo", "streak", "is_sample"],
  quiz_results: ["id", "school", "challenge_from", "user_id", "is_sample"],
  challenges: ["id", "status", "challenger_result_id", "challengee_result_id", "is_sample"],
  debates: ["id", "user_id", "argument", "score", "elo_before", "elo_after", "kind", "parent_debate_id", "is_sample", "verdict_is_template"],
  exchanges: ["id", "status", "debate_a", "debate_b", "next_turn", "is_sample"],
  turns: ["id", "exchange_id", "seq", "quoted_claim", "body"],
  reading_responses: ["id", "user_id", "response"],
  classes: ["id", "code", "owner_id"],
  class_members: ["class_id", "user_id"],
};

const same = (a: unknown, b: unknown) => (typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : a === b);

// The quiz v2 point, a `double precision` pair. Production's database
// prints float8 with extra_float_digits 0, so PostgREST returns 15
// significant digits: a stored -0.19899999999999998, the plan's to the bit,
// reads back as -0.199. A local database prints every digit. So the point
// is compared at those 15 digits, at which the stored value still has to
// be the plan's (the first canary of the fresh run, 2026-11-08, failed on
// exactly this read: 38 of 50 points).
const FLOAT8 = new Set(["map_x", "map_y"]);
const same15 = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? a.toPrecision(15) === b.toPrecision(15) : same(a, b);

export async function validate(
  adapter: Adapter,
  ds: Dataset,
  before: Baseline | null,
  opts: { cohortLimit?: number; spot?: number; authSpot?: number; rereadMs?: number } = {}
): Promise<ValidationReport> {
  const limit = opts.cohortLimit ?? Infinity;
  const checks: BaselineCheck[] = [];
  const rng = new Rng(`validate/${ds.runId}`);

  // 1. The registry: everything in scope is created.
  for (const p of phases(ds)) {
    const wanted = p.items.filter((i) => i.cohort < limit);
    const items = await adapter.items(ds.runId, p.kind as Kind);
    const created = new Set(items.filter((i) => i.state === "created").map((i) => i.logical_id));
    const missing = wanted.filter((w) => !created.has(w.logicalId)).length;
    checks.push({ name: `registry: ${p.kind} created`, ok: missing === 0, detail: `${wanted.length - missing} of ${wanted.length}` });
  }

  // 2. Sample rows per marked table equal the registry, across all runs.
  const runs = await adapter.listRuns();
  const kindOf: Record<string, Kind> = { profiles: "profile", quiz_results: "quiz_result", challenges: "challenge", debates: "debate", exchanges: "exchange" };
  for (const [table, kind] of Object.entries(kindOf)) {
    let registered = 0;
    for (const r of runs) if (r.status !== "torn_down") registered += (await adapter.items(r.id, kind)).filter((i) => i.state === "created").length;
    const marked = await adapter.count(table as Table, { sample: true });
    checks.push({ name: `${table}: sample rows match the registry`, ok: marked === registered, detail: `${marked} marked, ${registered} registered` });
  }

  // 3. Spot checks: rows read back equal the plan's.
  for (const p of phases(ds)) {
    if (!p.table) continue;
    const pool = p.items.filter((i) => i.cohort < limit);
    const sample = rng.shuffle(pool).slice(0, opts.spot ?? 50);
    if (!sample.length) continue;
    const back = await adapter.selectByIds(p.table, sample.map((s) => s.rowId));
    const byId = new Map(back.map((r) => [p.table === "class_members" ? `${r.class_id}:${r.user_id}` : String(r.id), r]));
    let bad = 0;
    let firstBad = "";
    for (const s of sample) {
      const r = byId.get(s.rowId);
      // A quiz v2 result's version and point too. Not a v1 row's: the plan
      // row has none, and the table's default reads back as version 1.
      const v2 = p.table === "quiz_results" && (s.row as { quiz_version?: number }).quiz_version === 2;
      const cols = [...(SPOT_COLUMNS[p.table] ?? []), ...(v2 ? ["quiz_version", "map_x", "map_y", "vector"] : [])];
      const diff = r ? cols.find((c) => !(FLOAT8.has(c) ? same15 : same)(r[c] ?? null, (s.row as Record<string, unknown>)[c] ?? null)) : "missing";
      if (diff) {
        bad++;
        firstBad ||= `${s.rowId}: ${diff}`;
      }
    }
    checks.push({ name: `spot check: ${p.table}`, ok: bad === 0, detail: bad ? `${bad} of ${sample.length} differ, e.g. ${firstBad}` : `${sample.length} rows match` });
  }
  const links = ds.challengeLinks.filter((l) => l.cohort < limit);
  if (links.length) {
    const back = await adapter.selectByIds("challenges", links.map((l) => l.rowId));
    const ok = links.every((l) => {
      const r = back.find((b) => b.id === l.rowId);
      return r && r.challenger_debate_id === l.row.challenger_debate_id && r.challengee_debate_id === l.row.challengee_debate_id;
    });
    checks.push({ name: "challenge links set", ok, detail: `${links.length} challenges` });
  }

  // 4. Every stored sample score is the plan's, and the plan's scores do
  // not cluster on multiples of 5; with the first, the second holds of what
  // was written.
  checks.push(await storedScoreCheck(adapter, ds, { cohortLimit: limit }));
  checks.push(roundScoreCheck(ds, { cohortLimit: limit }));

  // 5. No sample argument is waiting for a counterpart.
  const seeking = (await adapter.scan("debates", ["id", "seeking_counterpart_at"], { sample: true })).filter((d) => d.seeking_counterpart_at !== null).length;
  checks.push({ name: "no sample debate seeks a counterpart", ok: seeking === 0, detail: `${seeking} seeking` });

  // 6. Auth: a sample of users is blocked from signing in and is this run's.
  if (adapter.target !== "local") {
    const pool = ds.authUsers.filter((u) => u.cohort < limit);
    const picked = rng.shuffle(pool).slice(0, opts.authSpot ?? 20);
    let bad = 0;
    for (const u of picked) {
      const a = await adapter.getAuthUser(u.rowId);
      if (!a || !a.loginBlocked || a.runId !== ds.runId || a.email !== u.row.email) bad++;
    }
    checks.push({ name: "auth users blocked from signing in and owned by the run", ok: bad === 0, detail: `${picked.length - bad} of ${picked.length}` });
  }

  // 7. Genuine data. With a baseline, the comparison; without one (a
  // standalone --validate), the par and percentile checks still run, since
  // they need none. Either is read again before a failure is reported.
  const settled = await settledChecks(adapter, (now) => (before ? compareBaselines(before, now) : isolationChecks(now)), { waitMs: opts.rereadMs });
  const after = settled.now;
  checks.push(...settled.checks);

  return { ok: checks.every((c) => c.ok), checks, after };
}
