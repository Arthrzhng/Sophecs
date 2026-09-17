"use client";

import { useState } from "react";
import { RetrievalPrompt } from "./RetrievalPrompt";
import { chunkLesson, type MicroLessonContent } from "@/lib/lesson-chunks";

// The "before" lesson with retrieval prompts interleaved. Separate from
// MicroLesson rather than a mode on it, so /lessons/[slug] and the
// verdict-page objection keep rendering the exact tree they rendered
// before this existed.
//
// A lesson with no prompts produces one chunk, which is the whole body and
// the Begin button in the same place as always — the no-prompt path is the
// old path, not a special case of the new one.
export function ReadingFlow({
  lesson,
  topicSlug,
  userId,
  responses,
  onResponse,
  action,
}: {
  lesson: MicroLessonContent;
  topicSlug: string;
  userId: string;
  // Held by DebateFlow, because the editor on the next screen quotes these
  // back and a note written on this screen has to survive the transition.
  responses: Record<number, string>;
  onResponse: (chunkIndex: number, value: string) => void;
  action?: React.ReactNode;
}) {
  const chunks = chunkLesson(lesson);

  // How much of the lesson is on screen. Someone who already answered both
  // prompts on an earlier visit sees the whole thing immediately rather
  // than being made to click through their own answers again. Initial
  // state only — later answers advance it through setRevealed.
  const [revealed, setRevealed] = useState(
    () => chunks.filter((c, i) => c.prompt && responses[i] !== undefined).length + 1
  );

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">Before you argue</p>
      <h1 className="font-serif text-2xl font-medium">{lesson.title}</h1>

      {chunks.slice(0, revealed).map((chunk, i) => {
        const answered = responses[i] !== undefined;
        return (
          <div key={i} className={i > 0 ? "reveal" : undefined}>
            <div className="mt-6 prose-reading">
              {chunk.paragraphs.map((paragraph, j) => (
                <p key={j}>{paragraph}</p>
              ))}
            </div>

            {chunk.prompt && !answered && (
              <RetrievalPrompt
                topicSlug={topicSlug}
                chunkIndex={i}
                userId={userId}
                prompt={chunk.prompt.prompt}
                onSaved={(value) => {
                  onResponse(i, value);
                  setRevealed((prev) => Math.max(prev, i + 2));
                }}
              />
            )}

            {/* Once answered the note stays visible rather than collapsing:
                it is the thing the editor will quote back in a minute. */}
            {chunk.prompt && answered && (
              <div className="my-8 border-l-2 border-rule pl-4">
                <p className="font-sans text-sm text-ink-mid">{chunk.prompt.prompt}</p>
                <p className="mt-2 font-serif text-base text-ink">{responses[i]}</p>
              </div>
            )}
          </div>
        );
      })}

      {revealed >= chunks.length && (
        <>
          <p className="mt-4 font-mono text-xs text-ink-soft">
            — {lesson.source.author}, {lesson.source.work}, {lesson.source.section}
          </p>
          {action && <div className="mt-10">{action}</div>}
        </>
      )}
    </div>
  );
}
