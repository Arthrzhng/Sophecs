import type { MicroLessonContent } from "@/lib/lesson-chunks";
import { formatSource } from "@/lib/footnotes";

/**
 * Today's optional "view from elsewhere": Phase 3.0 preview only (Stage 4
 * of the brief of 2026-11-03). It sits after the after-reading and is not
 * a seventh step: it has no check, and nothing on the path waits for it.
 * Copy: docs/daily-path-copy.md, "Today, the view from elsewhere". The
 * passage's title and source are its own, from content/micro.
 */
export function ElsewhereCard({ lesson }: { lesson: MicroLessonContent }) {
  return (
    <section className="rounded-panel border-2 border-dashed border-rule-strong bg-surface p-5">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Optional</p>
      <h3 className="mt-2 text-base font-extrabold text-ink">A view from elsewhere</h3>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-mid">
        Another tradition on this week&apos;s motion. There is no check, and it is not a step.
      </p>
      <p className="mt-4 font-serif text-base font-medium text-ink">{lesson.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{formatSource(lesson.source)}</p>
      {/* A button, as it would be on Today, so the preview shows its focus ring. */}
      <button
        type="button"
        className="chunky mt-4 inline-flex min-h-11 items-center rounded-chunky border-2 border-rule-strong bg-paper px-4 text-sm font-extrabold tracking-wide uppercase text-ink"
      >
        Read it
      </button>
    </section>
  );
}
