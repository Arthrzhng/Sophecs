"use client";

import { Chevron } from "@/components/ui/Chevron";
import { useRef } from "react";
import { track } from "@/lib/analytics/client";
import type { MicroLessonContent } from "@/lib/lesson-chunks";

// The lesson that used to be a separate screen with a Begin button in front
// of the editor. It is a disclosure on the write screen now, so the excerpt
// is there to look at again while writing rather than a screen the reader
// clicked past.
//
// Closed by default, including on a first argument. The reading step in
// front of this one already showed the lesson and took answers on it, so
// opening it again pushed the textarea about 1,100px below the fold at
// 360px for exactly the reader least able to afford that. The title is in
// the summary line, so the thing behind the disclosure is named rather than
// hidden.
//
// Native <details>, so the open state, the keyboard handling and the
// in-page find are the browser's.
export function BeforeLesson({ lesson }: { lesson: MicroLessonContent }) {
  const fired = useRef(false);

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (e.currentTarget.open && !fired.current) {
      fired.current = true;
      track({ name: "micro_lesson_viewed", props: { slug: lesson.slug, position: "before" } });
    }
  }

  return (
    <details onToggle={onToggle} className="group border-y border-rule py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-ink [&::-webkit-details-marker]:hidden">
        {/* The chevron sits on the first line when the title wraps. */}
        <span className="flex items-start gap-2">
          <Chevron className="mt-0.5 text-ink-soft" />
          <span>Read the excerpt again: {lesson.title}</span>
        </span>
      </summary>
      <div className="prose-reading mt-5">
        {lesson.body.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {lesson.source.author}, {lesson.source.work}, {lesson.source.section}
      </p>
    </details>
  );
}
