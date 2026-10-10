// Pure — deliberately free of `server-only`. The reading flow and the
// retrieval prompt are client components and need the shape of a lesson and
// the chunking rule; only the filesystem loading stays server-side, in
// `micro-lessons.ts`.

export interface RetrievalPrompt {
  // 0-based index of the paragraph this prompt follows.
  after_paragraph: number;
  prompt: string;
}

export interface MicroLessonContent {
  slug: string;
  topic: string;
  /**
   * Where the passage sits relative to arguing the motion.
   *
   * `before` and `after` are the pair every motion ships with, and the
   * reading flow is built on there being exactly two. `elsewhere` is a
   * third reading on the same motion from a tradition the product does not
   * yet teach as a school. It has no production surface: it is keyed to a
   * motion by `topic` like the other two, but nothing in the live app
   * enumerates it, and it is written as a draft so no loader returns it.
   */
  position: "before" | "after" | "elsewhere";
  /** See lib/drafts.ts. Draft files load only on /styleguide/drafts. */
  status?: "draft";
  title: string;
  // `translation`: see Source in footnotes.ts.
  source: { author: string; work: string; section: string; translation?: string };
  body: string; // 150-250 words, frontmatter field — same convention as content/schools' `read`
  // Optional, "before" lessons only in practice. At most two, each following
  // a paragraph that exists, each answerable from the paragraphs above it.
  retrieval_prompts?: RetrievalPrompt[];
  // "Check your reading": asked once the whole passage has been read, after
  // the free-text retrieval prompts. Every "before" lesson has exactly
  // READING_CHECK_LENGTH of these; "after" lessons have none.
  reading_check?: ReadingCheckQuestion[];
}

// One multiple-choice question about the passage. `answer` is the 0-based
// index into `options`. `right` and `wrong` are the explanations shown under
// the interface's own "Exactly." / "Not quite." heading, so neither starts
// with a verdict word of its own. `wrong` is written to make sense whichever
// wrong option was picked.
export interface ReadingCheckQuestion {
  question: string;
  options: string[];
  answer: number;
  right: string;
  wrong: string;
}

/**
 * Reading order within a motion.
 *
 * Written out rather than compared inline, because the sort this replaces
 * was `position === "before" ? -1 : 1`, which would have dropped a third
 * position wherever the comparison happened to land. "before" then
 * "after" is unchanged, and "elsewhere" sorts last.
 */
export const POSITION_ORDER: Record<MicroLessonContent["position"], number> = {
  before: 0,
  after: 1,
  elsewhere: 2,
};

export const READING_CHECK_LENGTH = 2;
export const READING_CHECK_OPTIONS = 3;
// Options render as chunky full-width cards on a 375px screen; past this
// they wrap to a fourth line and the three stop fitting above the fold.
export const MAX_READING_CHECK_OPTION_CHARS = 100;

// How many of the reader's picks were right. Picks are option indices, in
// question order; an unanswered question (undefined) counts as not right.
export function readingCheckScore(
  check: ReadingCheckQuestion[],
  picks: (number | undefined)[]
): number {
  return check.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
}

const VERDICT_OPENERS = /^(exactly|not quite|right|wrong|yes|no|correct|incorrect)\b/i;

// Every problem with a lesson's reading check, as messages naming the
// question. Empty means valid. Pure so the content test can run it without
// the `server-only` loader; micro-lessons.ts throws on the first message at
// build time.
export function readingCheckProblems(lesson: MicroLessonContent): string[] {
  const where = `content/micro/${lesson.slug}.md`;
  const check = lesson.reading_check;

  // Only a "before" lesson has a reading check. The test is written this
  // way round on purpose: a position added later inherits "no check" rather
  // than inheriting the requirement to carry one, which is what the old
  // `position === "after"` test would have done to "elsewhere".
  if (lesson.position !== "before") {
    return check === undefined
      ? []
      : [`${where}: only "before" lessons have a reading_check`];
  }
  if (!Array.isArray(check) || check.length !== READING_CHECK_LENGTH) {
    return [`${where}: reading_check must list exactly ${READING_CHECK_LENGTH} questions`];
  }

  const problems: string[] = [];
  check.forEach((q, i) => {
    const at = `${where}: reading_check question ${i + 1}`;
    for (const field of ["question", "right", "wrong"] as const) {
      if (typeof q[field] !== "string" || q[field].trim().length === 0) {
        problems.push(`${at}: ${field} is empty`);
      }
    }
    for (const field of ["right", "wrong"] as const) {
      if (typeof q[field] === "string" && VERDICT_OPENERS.test(q[field].trim())) {
        problems.push(`${at}: ${field} starts with a verdict word; the interface supplies "Exactly." / "Not quite."`);
      }
    }
    if (!Array.isArray(q.options) || q.options.length !== READING_CHECK_OPTIONS) {
      problems.push(`${at}: needs exactly ${READING_CHECK_OPTIONS} options`);
      return;
    }
    q.options.forEach((option, j) => {
      if (typeof option !== "string" || option.trim().length === 0) {
        problems.push(`${at}: option ${j + 1} is empty`);
      } else if (option.length > MAX_READING_CHECK_OPTION_CHARS) {
        problems.push(`${at}: option ${j + 1} is ${option.length} characters, maximum is ${MAX_READING_CHECK_OPTION_CHARS}`);
      }
    });
    if (new Set(q.options).size !== q.options.length) {
      problems.push(`${at}: two options are identical`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      problems.push(`${at}: answer must be an option index, 0-${q.options.length - 1}`);
    }
  });
  return problems;
}

export const MAX_RETRIEVAL_PROMPTS = 2;
export const MAX_RETRIEVAL_RESPONSE_CHARS = 300;

export interface LessonChunk {
  paragraphs: string[];
  prompt: RetrievalPrompt | null;
}

// Splits a lesson body into the chunks the reader is shown between prompts.
// Returns one more chunk than there are prompts: paragraphs up to the first
// prompt, then up to the second, then whatever is left. A lesson with no
// prompts is one chunk, which is exactly what it rendered before.
export function chunkLesson(lesson: MicroLessonContent): LessonChunk[] {
  const paragraphs = lesson.body.split("\n\n");
  const prompts = [...(lesson.retrieval_prompts ?? [])].sort(
    (a, b) => a.after_paragraph - b.after_paragraph
  );

  const chunks: LessonChunk[] = [];
  let cursor = 0;
  for (const prompt of prompts) {
    const end = prompt.after_paragraph + 1;
    chunks.push({ paragraphs: paragraphs.slice(cursor, end), prompt });
    cursor = end;
  }
  // The tail always exists as a chunk, even when empty, so the caller can
  // rely on chunks.length === prompts.length + 1.
  chunks.push({ paragraphs: paragraphs.slice(cursor), prompt: null });
  return chunks;
}
