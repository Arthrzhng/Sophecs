/**
 * Quiz v2's result logic (docs/quiz-v2.md, section 4), as
 * scripts/simulate-quiz-v2.mjs applies it to every possible answer pattern:
 *
 * - a reader's position is the mean of their ten options' vectors, a point
 *   on the map;
 * - each school sits on the unit circle at its angle;
 * - the nearest school wins and the second nearest is the secondary;
 * - an exact tie on distance (squared distances within 1e-9) goes to
 *   whichever tied school is nearer the reader's answer to the last
 *   question, then to the order the schools are listed in.
 *
 * It names no school. The schools, their angles and the options' vectors
 * arrive as data, so this module can run in the browser on a build without
 * SIX_SCHOOLS and carry nothing `npm run check:bundle` would find. The data
 * itself is read on the server only (src/lib/quiz-v2.ts), and only on a
 * SIX_SCHOOLS build. tests/quiz-v2-score.test.ts holds this to the
 * simulator over all 1,048,576 patterns.
 */

export interface MapPoint {
  x: number;
  y: number;
}

/** A school on the map: its id and its angle in degrees, anticlockwise from the x axis's positive end. */
export interface MapSchoolPosition {
  id: string;
  angle: number;
}

export interface QuizV2Option {
  id: string;
  label: string;
  vector: MapPoint;
}

export interface QuizV2Question {
  id: number;
  prompt: string;
  options: QuizV2Option[];
}

export interface QuizV2Score {
  primary: string;
  secondary: string;
  point: MapPoint;
}

const EPS = 1e-9;

export function onCircle(angle: number): MapPoint {
  const a = (angle * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

const d2 = (p: MapPoint, s: MapPoint) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2;

/** The mean of some options' vectors: where they put a reader. The middle of the map when there are none. */
export function meanPoint(options: { vector: MapPoint }[]): MapPoint {
  if (options.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const o of options) {
    x += o.vector.x;
    y += o.vector.y;
  }
  return { x: x / options.length, y: y / options.length };
}

/** The schools nearest first, ties broken by `last` and then by list order. */
export function rankSchools(point: MapPoint, last: MapPoint, schools: readonly MapSchoolPosition[]): string[] {
  const pos = new Map(schools.map((s) => [s.id, onCircle(s.angle)]));
  const order = new Map(schools.map((s, i) => [s.id, i]));
  return schools
    .map((s) => s.id)
    .sort((a, b) => {
      const diff = d2(point, pos.get(a)!) - d2(point, pos.get(b)!);
      if (Math.abs(diff) > EPS) return diff;
      const tie = d2(last, pos.get(a)!) - d2(last, pos.get(b)!);
      if (Math.abs(tie) > EPS) return tie;
      return order.get(a)! - order.get(b)!;
    });
}

/** A whole quiz's result: the ten chosen options, in question order. */
export function scoreQuizV2(chosen: readonly QuizV2Option[], schools: readonly MapSchoolPosition[]): QuizV2Score {
  if (chosen.length === 0) throw new Error("quiz v2: no answers to score");
  if (schools.length < 2) throw new Error("quiz v2: fewer than two schools to rank");
  const point = meanPoint([...chosen]);
  const [primary, secondary] = rankSchools(point, chosen[chosen.length - 1].vector, schools);
  return { primary, secondary, point };
}
