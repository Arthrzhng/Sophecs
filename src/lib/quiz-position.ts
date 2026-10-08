import { SCHOOL_IDS, type SchoolVector } from "./types";

/**
 * Where a reader sits on the three-school triangle.
 *
 * The quiz already scores every answer as a weighting across all three
 * schools rather than one-hot, so a position between them is information
 * the product has always had and never showed. This turns that weighting
 * into a point; it computes no score of its own and changes nothing about
 * how the quiz is marked. lib/scoring.ts remains the only thing that
 * decides which school you land in.
 *
 * Vertices match mockup 02's triangle, in its own 300x270 viewBox.
 */
export const TRIANGLE = {
  width: 300,
  height: 270,
  vertices: {
    stoicism: { x: 150, y: 26 },
    utilitarianism: { x: 26, y: 240 },
    "virtue-ethics": { x: 274, y: 240 },
  },
} as const;

export interface Point {
  x: number;
  y: number;
}

/** The middle of the triangle: equal parts of all three. */
export function centroid(): Point {
  const v = Object.values(TRIANGLE.vertices);
  return {
    x: v.reduce((s, p) => s + p.x, 0) / v.length,
    y: v.reduce((s, p) => s + p.y, 0) / v.length,
  };
}

/**
 * A normalized three-school weighting as a point inside the triangle.
 *
 * A vector that sums to zero means nothing has been answered yet. That
 * maps to the centroid rather than to the origin, which is outside the
 * triangle entirely and would put the marker in the corner of the frame.
 */
export function vectorToPoint(vector: SchoolVector): Point {
  const sum = SCHOOL_IDS.reduce((s, id) => s + vector[id], 0);
  if (sum <= 0) return centroid();
  return SCHOOL_IDS.reduce(
    (acc, id) => {
      const weight = vector[id] / sum;
      const vertex = TRIANGLE.vertices[id];
      return { x: acc.x + vertex.x * weight, y: acc.y + vertex.y * weight };
    },
    { x: 0, y: 0 }
  );
}
