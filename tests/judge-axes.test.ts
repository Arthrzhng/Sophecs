import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JUDGE_AXES, AXIS_MAX } from "../src/lib/judge-axes";

const PROMPT = fs.readFileSync(
  path.join(process.cwd(), "content/prompts/judge.v2.md"),
  "utf8"
);

describe("the judge's axes", () => {
  // Mockups 02, 04 and 06 all leave room for four, the landing mockup says
  // "four axes" in prose, and the verdict table this replaced called itself
  // four by counting the composite score as one. The prompt is the only
  // thing that actually decides, so the test reads the prompt.
  it("is three, matching content/prompts/judge.v2.md", () => {
    expect(JUDGE_AXES).toHaveLength(3);
  });

  it("names the three criteria the prompt scores, in the prompt's order of weight", () => {
    const order = ["Fidelity", "Rigor", "Engagement"];
    expect(JUDGE_AXES.map((a) => a.label.split(" ")[0])).toEqual(order);

    // Each appears in the prompt as a numbered, bolded criterion.
    order.forEach((name, i) => {
      expect(PROMPT).toContain(`${i + 1}. **${name}**`);
    });
  });

  it("uses the keys the judge's own response shape uses", () => {
    expect(JUDGE_AXES.map((a) => a.key)).toEqual(["fidelity", "rigor", "engagement"]);
    for (const key of JUDGE_AXES.map((a) => a.key)) {
      expect(PROMPT).toContain(`"${key}": 0`);
    }
  });

  it("scores each criterion out of ten, as the prompt states", () => {
    expect(AXIS_MAX).toBe(10);
    expect(PROMPT).toContain("are each 0-10");
  });

  it("gives every axis a description that does not restate its own label", () => {
    for (const axis of JUDGE_AXES) {
      expect(axis.description.trim().length).toBeGreaterThan(20);
      expect(axis.description.startsWith(axis.label)).toBe(false);
    }
  });
});
