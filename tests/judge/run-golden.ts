// Runs the golden set against the real judge model and prints a table.
// Run before and after any change to the prompt or rubric — paste both
// tables when reporting a change, per the brief.
//
//   npm run judge:golden
//
// Requires ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY (npm run
// judge:golden loads .env.local via Node's --env-file). This is one of
// exactly two call sites for the Anthropic API in this repo — the other is
// /api/judge.
import fs from "node:fs";
import path from "node:path";
import { callJudgeModel, logAiCall, JudgeValidationError } from "../../src/lib/anthropic";
import type { SchoolId } from "../../src/lib/types";

interface GoldenCase {
  name: string;
  motion: string;
  school: SchoolId;
  argument: string;
  expected_score_band: [number, number];
  expected_fidelity_band: [number, number];
  // v2: the schools whose objection would be a legitimate one to raise
  // against this argument — always the two the argument was not written
  // from. A set rather than a single value on purpose: either rival is a
  // defensible pick, so pinning one would fail the run on a coin flip.
  expected_objection_school: SchoolId[];
}

function loadCases(): GoldenCase[] {
  const dir = path.join(process.cwd(), "tests", "judge", "golden");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as GoldenCase);
}

function inBand(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

async function main() {
  const cases = loadCases();
  const rows: {
    name: string;
    scoreBand: string;
    score: number | string;
    scorePass: boolean;
    fidelityBand: string;
    fidelity: number | string;
    fidelityPass: boolean;
    objection: string;
    objectionPass: boolean;
    note: string;
  }[] = [];

  let anyFail = false;

  for (const c of cases) {
    // One case failing (a validation error, a network blip) must not abort
    // the rest of the run — each case gets its own row, pass or fail.
    let result: Awaited<ReturnType<typeof callJudgeModel>>;
    try {
      result = await callJudgeModel(c.motion, c.school, c.argument);
    } catch (err) {
      if (err instanceof JudgeValidationError) {
        await logAiCall({
          userId: null,
          debateId: null,
          kind: "golden",
          costUsd: err.costUsd,
          latencyMs: err.latencyMs,
        });
      }
      rows.push({
        name: c.name,
        scoreBand: c.expected_score_band.join("-"),
        score: "error",
        scorePass: false,
        fidelityBand: c.expected_fidelity_band.join("-"),
        fidelity: "-",
        fidelityPass: false,
        objection: "-",
        objectionPass: false,
        note: err instanceof Error ? err.message : "error",
      });
      anyFail = true;
      continue;
    }

    const { verdict, costUsd, latencyMs } = result;
    await logAiCall({ userId: null, debateId: null, kind: "golden", costUsd, latencyMs });

    if (verdict.rejected) {
      rows.push({
        name: c.name,
        scoreBand: c.expected_score_band.join("-"),
        score: "rejected",
        scorePass: false,
        fidelityBand: c.expected_fidelity_band.join("-"),
        fidelity: "rejected",
        fidelityPass: false,
        objection: "-",
        objectionPass: false,
        note: "model rejected the submission",
      });
      anyFail = true;
      continue;
    }

    const scorePass = inBand(verdict.score, c.expected_score_band);
    const fidelityPass = inBand(verdict.fidelity, c.expected_fidelity_band);

    // The objection must come from a rival school. Drawing it from the
    // school the argument was written from would make it unanswerable by
    // revision, which is the whole point of naming it.
    const objectionSchool = verdict.unanswered_objection.school;
    const objectionPass =
      objectionSchool !== c.school && c.expected_objection_school.includes(objectionSchool);

    if (!scorePass || !fidelityPass || !objectionPass) anyFail = true;

    rows.push({
      name: c.name,
      scoreBand: c.expected_score_band.join("-"),
      score: verdict.score,
      scorePass,
      fidelityBand: c.expected_fidelity_band.join("-"),
      fidelity: verdict.fidelity,
      fidelityPass,
      objection: objectionSchool,
      objectionPass,
      note: objectionPass ? "" : `objection drawn from ${objectionSchool} (argued: ${c.school})`,
    });
  }

  console.table(
    rows.map((r) => ({
      case: r.name,
      "score (band)": `${r.score} (${r.scoreBand})`,
      score_ok: r.scorePass ? "✓" : "✗",
      "fidelity (band)": `${r.fidelity} (${r.fidelityBand})`,
      fidelity_ok: r.fidelityPass ? "✓" : "✗",
      objection: r.objection,
      obj_ok: r.objectionPass ? "✓" : "✗",
    }))
  );

  // Outside the table: console.table truncates, and a validation failure's
  // whole value is in knowing which field breached its cap.
  for (const r of rows.filter((row) => row.note)) {
    console.log(`  ${r.name}: ${r.note}`);
  }

  if (anyFail) {
    console.error("One or more golden cases fell outside its expected band.");
    process.exitCode = 1;
  } else {
    console.log("All golden cases within their expected bands.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
