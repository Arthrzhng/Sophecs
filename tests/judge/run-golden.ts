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
import { callJudgeModel, logAiCall } from "../../src/lib/anthropic";
import type { SchoolId } from "../../src/lib/types";

interface GoldenCase {
  name: string;
  motion: string;
  school: SchoolId;
  argument: string;
  expected_score_band: [number, number];
  expected_fidelity_band: [number, number];
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
  }[] = [];

  let anyFail = false;

  for (const c of cases) {
    const { verdict, costUsd, latencyMs } = await callJudgeModel(c.motion, c.school, c.argument);
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
      });
      anyFail = true;
      continue;
    }

    const scorePass = inBand(verdict.score, c.expected_score_band);
    const fidelityPass = inBand(verdict.fidelity, c.expected_fidelity_band);
    if (!scorePass || !fidelityPass) anyFail = true;

    rows.push({
      name: c.name,
      scoreBand: c.expected_score_band.join("-"),
      score: verdict.score,
      scorePass,
      fidelityBand: c.expected_fidelity_band.join("-"),
      fidelity: verdict.fidelity,
      fidelityPass,
    });
  }

  console.table(
    rows.map((r) => ({
      case: r.name,
      "score (band)": `${r.score} (${r.scoreBand})`,
      score_ok: r.scorePass ? "✓" : "✗",
      "fidelity (band)": `${r.fidelity} (${r.fidelityBand})`,
      fidelity_ok: r.fidelityPass ? "✓" : "✗",
    }))
  );

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
