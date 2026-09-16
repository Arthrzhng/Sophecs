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
  position: "before" | "after";
  title: string;
  source: { author: string; work: string; section: string };
  body: string; // 150-250 words, frontmatter field — same convention as content/schools' `read`
  // Optional, "before" lessons only in practice. At most two, each following
  // a paragraph that exists, each answerable from the paragraphs above it.
  retrieval_prompts?: RetrievalPrompt[];
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
