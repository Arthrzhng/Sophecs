import type { MicroLessonContent } from "./lesson-chunks";

type Passage = Pick<MicroLessonContent, "slug" | "topic" | "position">;

export interface PassagePlace<T extends Passage> {
  /** An optional view from elsewhere, outside the motion's pair. */
  elsewhere: boolean;
  /**
   * The passage to link to next: from the pair, the other one; from an
   * elsewhere passage, the before passage, which frames the question.
   */
  sibling: T | null;
  /** The reading number within the pair, or null for an elsewhere passage. */
  index: number | null;
  /** How many passages the pair has. */
  total: number;
}

/**
 * Where a passage sits among its motion's passages, for /lessons/[slug].
 *
 * The pair is before and after, which every motion ships with and the
 * reading count is built on. An "elsewhere" passage, which a SIX_SCHOOLS
 * build loads, is not part of it: it is optional, has no number, and does
 * not change the pair's ("1 of 2", never "1 of 3").
 *
 * `all` in the order `getAllMicroLessons` returns, which puts "before"
 * ahead of "after", so a passage's place in the pair is its number.
 */
export function passagePlace<T extends Passage>(lesson: T, all: readonly T[]): PassagePlace<T> {
  const pair = all.filter((l) => l.topic === lesson.topic && l.position !== "elsewhere");
  const elsewhere = lesson.position === "elsewhere";
  return {
    elsewhere,
    sibling: elsewhere
      ? (pair.find((l) => l.position === "before") ?? null)
      : (pair.find((l) => l.position !== lesson.position) ?? null),
    index: elsewhere ? null : pair.findIndex((l) => l.slug === lesson.slug) + 1,
    total: pair.length,
  };
}
