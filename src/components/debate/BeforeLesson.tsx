"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/client";
import type { MicroLessonContent } from "@/lib/lesson-chunks";

// The lesson that used to be a separate screen with a Begin button in front
// of the editor. It is a disclosure on the write screen now: a reader who
// has just read it should be able to look at it again while writing without
// losing the draft, and a reader on their fifth motion should not be made
// to click past it.
//
// Native <details>, so the open state, the keyboard handling and the
// in-page find are the browser's. Open by default on a first argument,
// closed after that.
export function BeforeLesson({
  lesson,
  defaultOpen,
}: {
  lesson: MicroLessonContent;
  defaultOpen: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    // Fires once whether or not the disclosure is opened by hand: on a
    // first argument it is open on arrival, and the event means "this
    // reader was shown the lesson", which is true either way.
    if (defaultOpen && !fired.current) {
      fired.current = true;
      track({ name: "micro_lesson_viewed", props: { slug: lesson.slug, position: "before" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (e.currentTarget.open && !fired.current) {
      fired.current = true;
      track({ name: "micro_lesson_viewed", props: { slug: lesson.slug, position: "before" } });
    }
  }

  return (
    <details
      open={defaultOpen}
      onToggle={onToggle}
      className="border-y border-rule py-4"
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-ink-soft transition-transform [[open]_&]:rotate-90"
        >
          ▸
        </span>
        Before you argue: {lesson.title}
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
