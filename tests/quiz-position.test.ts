import { describe, it, expect } from "vitest";
import { vectorToPoint, centroid, TRIANGLE } from "../src/lib/quiz-position";
import type { SchoolVector } from "../src/lib/types";

const v = (s: number, u: number, ve: number): SchoolVector => ({
  stoicism: s,
  utilitarianism: u,
  "virtue-ethics": ve,
});

describe("vectorToPoint", () => {
  it("puts a pure school exactly on its own corner", () => {
    expect(vectorToPoint(v(1, 0, 0))).toEqual(TRIANGLE.vertices.stoicism);
    expect(vectorToPoint(v(0, 1, 0))).toEqual(TRIANGLE.vertices.utilitarianism);
    expect(vectorToPoint(v(0, 0, 1))).toEqual(TRIANGLE.vertices["virtue-ethics"]);
  });

  it("puts an even split in the middle", () => {
    const p = vectorToPoint(v(1, 1, 1));
    expect(p.x).toBeCloseTo(centroid().x, 6);
    expect(p.y).toBeCloseTo(centroid().y, 6);
  });

  it("does not care whether the vector is already normalized", () => {
    expect(vectorToPoint(v(2, 1, 1))).toEqual(vectorToPoint(v(0.5, 0.25, 0.25)));
  });

  it("puts an unanswered quiz in the middle rather than at the origin", () => {
    // scoreQuiz([]) returns all zeros; the origin is outside the triangle.
    expect(vectorToPoint(v(0, 0, 0))).toEqual(centroid());
  });

  it("lands between two corners when the third is absent", () => {
    const p = vectorToPoint(v(1, 0, 1));
    const s = TRIANGLE.vertices.stoicism;
    const ve = TRIANGLE.vertices["virtue-ethics"];
    expect(p.x).toBeCloseTo((s.x + ve.x) / 2, 6);
    expect(p.y).toBeCloseTo((s.y + ve.y) / 2, 6);
  });

  it("stays inside the triangle's frame for any weighting", () => {
    for (const vec of [v(5, 1, 1), v(1, 5, 1), v(1, 1, 5), v(3, 2, 1)]) {
      const p = vectorToPoint(vec);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(TRIANGLE.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(TRIANGLE.height);
    }
  });
});
