import "server-only";
import raw from "../../docs/quiz-v2.json";
import type { MapSchool } from "@/components/phase3/SchoolMap";
import { isShown, schoolColourVar, schoolName } from "@/lib/school-registry";
import type { MapSchoolPosition, QuizV2Question } from "@/lib/quiz-v2-score";
import type { SchoolId } from "@/lib/types";

/**
 * Quiz v2, on a SIX_SCHOOLS build (docs/stage5-plan.md, step 4).
 *
 * The questions, options, vectors, school angles and axis names are
 * docs/quiz-v2.json, the file Arthur accepted at Checkpoint A (item 15) and
 * scripts/simulate-quiz-v2.mjs reads, so the quiz and its simulation cannot
 * drift apart. It is read here, on the server, and handed to client
 * components as props: the file names the three unpublished schools, and a
 * client module that imported it would carry them into every build's
 * bundle. Only a SIX_SCHOOLS build renders anything from it, so only that
 * build's pages carry it at all.
 *
 * The shape is checked the first time a page reads it, which on a
 * SIX_SCHOOLS build is while the build prerenders /quiz, as the simulator
 * checks it: ten questions of four options, every option's school one with
 * an angle and a weight, every vector that school's direction times its
 * weight, and every school one this build shows. A malformed file fails
 * the build rather than shipping a quiz that cannot be scored.
 */

/** Whether this build runs quiz v2. The flag is written in as a constant (next.config.ts). */
export const QUIZ_V2_ON = process.env.SIX_SCHOOLS === "1";

export interface QuizV2Data {
  questions: QuizV2Question[];
  /** In the order docs/quiz-v2.md's section 2 lists them, which breaks the last tie. */
  schools: MapSchoolPosition[];
  /** The map's axis labels as SchoolMap takes them: [negative end, positive end]. */
  axes: { x: [string, string]; y: [string, string] };
}

type RawQuiz = {
  axes: Record<"x" | "y", { minus: string; plus: string }>;
  schools: Record<string, { name: string; angle: number }>;
  radius_by_school: Record<string, number>;
  questions: { id: number; prompt: string; options: { id: string; label: string; leans: string; vector: { x: number; y: number } }[] }[];
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function load(): QuizV2Data {
  const quiz = raw as RawQuiz;
  const schools = Object.entries(quiz.schools).map(([id, s]) => ({ id, angle: s.angle }));
  const ids = new Set(schools.map((s) => s.id));
  if (quiz.questions.length !== 10) throw new Error(`quiz v2: expected 10 questions, found ${quiz.questions.length}`);
  for (const q of quiz.questions) {
    if (q.options.length !== 4) throw new Error(`quiz v2: question ${q.id} has ${q.options.length} options, not 4`);
    for (const o of q.options) {
      if (!ids.has(o.leans)) throw new Error(`quiz v2: option ${o.id} leans to "${o.leans}", which has no position`);
      if (!Number.isFinite(o.vector.x) || !Number.isFinite(o.vector.y)) throw new Error(`quiz v2: option ${o.id} has no vector`);
      // As the simulator checks it: the vector is the school's direction
      // times the school's weight, to the two places the file rounds to.
      const weight = quiz.radius_by_school?.[o.leans];
      if (typeof weight !== "number") throw new Error(`quiz v2: no weight for ${o.leans}`);
      const a = (quiz.schools[o.leans].angle * Math.PI) / 180;
      if (Math.abs(Math.cos(a) * weight - o.vector.x) > 0.006 || Math.abs(Math.sin(a) * weight - o.vector.y) > 0.006)
        throw new Error(`quiz v2: option ${o.id}'s vector is not ${o.leans}'s direction times ${weight}`);
    }
  }
  return {
    // `leans` stays here: the result is computed from the vectors, and the
    // school each option points at is not something a reader is shown.
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, label: o.label, vector: { x: o.vector.x, y: o.vector.y } })),
    })),
    schools,
    axes: {
      x: [capitalise(quiz.axes.x.minus), capitalise(quiz.axes.x.plus)],
      y: [capitalise(quiz.axes.y.minus), capitalise(quiz.axes.y.plus)],
    },
  };
}

let cached: QuizV2Data | null = null;

/** Quiz v2's data. Throws on a build without SIX_SCHOOLS, which has no quiz v2 to give. */
export function quizV2(): QuizV2Data {
  if (!QUIZ_V2_ON) throw new Error("quiz v2 is shown on SIX_SCHOOLS builds only");
  if (!cached) {
    const data = load();
    const hidden = data.schools.filter((s) => !isShown(s.id as SchoolId)).map((s) => s.id);
    if (hidden.length) throw new Error(`quiz v2: schools this build does not show: ${hidden.join(", ")}`);
    cached = data;
  }
  return cached;
}

/** The map's schools for SchoolMap: name and colour from the registry, angle from the quiz. */
export function quizV2MapSchools(): MapSchool[] {
  return quizV2().schools.map((s) => ({
    id: s.id,
    name: schoolName(s.id as SchoolId),
    angle: s.angle,
    colour: schoolColourVar(s.id as SchoolId),
  }));
}

/** For tests: the file's shape, whatever build this is. */
export const loadQuizV2ForTest = load;
