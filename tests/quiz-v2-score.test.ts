// Quiz v2's scorer against its simulator (docs/stage5-plan.md, step 4).
// scripts/simulate-quiz-v2.mjs is what Arthur accepted the distribution
// from (docs/quiz-v2.md, section 5); src/lib/quiz-v2-score.ts is what the
// quiz runs. Every one of the 4^10 answer patterns goes through the
// scorer here, and the shares, the ties and the personas must be the ones
// the simulator prints.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { loadQuizV2ForTest } from "../src/lib/quiz-v2";
import { meanPoint, rankSchools, scoreQuizV2, type MapPoint, type QuizV2Option } from "../src/lib/quiz-v2-score";

import RAW_JSON from "../docs/quiz-v2.json";

const RAW = RAW_JSON as unknown as { schools: Record<string, { name: string }> };
const quiz = loadQuizV2ForTest();
const simulated = execFileSync(process.execPath, ["scripts/simulate-quiz-v2.mjs"], { encoding: "utf8" });

describe("quiz v2's scorer, against scripts/simulate-quiz-v2.mjs", () => {
  it("gives every school the share of the 1,048,576 patterns the simulator does", () => {
    const Q = quiz.questions;
    const primary = new Map<string, number>(quiz.schools.map((s) => [s.id, 0]));
    const pick: QuizV2Option[] = new Array(10);
    for (let n = 0; n < 4 ** 10; n++) {
      let k = n;
      for (let i = 0; i < 10; i++) {
        pick[i] = Q[i].options[k & 3];
        k >>= 2;
      }
      const { primary: p } = scoreQuizV2(pick, quiz.schools);
      primary.set(p, primary.get(p)! + 1);
    }
    for (const s of quiz.schools) {
      const share = ((100 * primary.get(s.id)!) / 4 ** 10).toFixed(1);
      // The simulator's row for the school: its name, the options pointing
      // at it, then its share as primary.
      const name = RAW.schools[s.id].name;
      const row = simulated.split("\n").find((l) => l.split("|")[0].trim() === name);
      expect(row, `no simulator row for ${name}`).toBeTruthy();
      expect(row!.split("|")[2].trim(), name).toBe(`${share}%`);
    }
    expect(simulated).toContain("exact ties on distance: 0");
  }, 120_000);

  it("places each persona where the simulator does", () => {
    const d2 = (a: MapPoint, b: MapPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    for (const s of quiz.schools) {
      const a = (s.angle * Math.PI) / 180;
      const target = { x: Math.cos(a), y: Math.sin(a) };
      const chosen = quiz.questions.map((q) => [...q.options].sort((x, y) => d2(x.vector, target) - d2(y.vector, target))[0]);
      const r = scoreQuizV2(chosen, quiz.schools);
      const line = `-> ${r.primary} (then ${r.secondary}) at (${r.point.x.toFixed(2)}, ${r.point.y.toFixed(2)})`;
      expect(simulated).toContain(line);
      expect(r.primary).toBe(s.id);
    }
  });

  it("breaks an exact tie by the last answer, then by list order", () => {
    const schools = [
      { id: "east", angle: 0 },
      { id: "west", angle: 180 },
    ];
    // The middle is exactly as far from both.
    expect(rankSchools({ x: 0, y: 0 }, { x: -0.5, y: 0 }, schools)).toEqual(["west", "east"]);
    expect(rankSchools({ x: 0, y: 0 }, { x: 0.5, y: 0 }, schools)).toEqual(["east", "west"]);
    expect(rankSchools({ x: 0, y: 0 }, { x: 0, y: 0.5 }, schools)).toEqual(["east", "west"]);
  });

  it("takes the mean of the vectors as the reader's point", () => {
    expect(meanPoint([])).toEqual({ x: 0, y: 0 });
    expect(meanPoint([{ vector: { x: 1, y: 0 } }, { vector: { x: 0, y: 1 } }])).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("docs/quiz-v2.json, as the quiz reads it", () => {
  it("has ten questions of four options and six schools", () => {
    expect(quiz.questions).toHaveLength(10);
    expect(quiz.questions.every((q) => q.options.length === 4)).toBe(true);
    expect(quiz.schools).toHaveLength(6);
  });

  it("hands the client no option's school", () => {
    for (const q of quiz.questions) for (const o of q.options) expect(Object.keys(o).sort()).toEqual(["id", "label", "vector"]);
  });
});
