import type { MicroLessonContent } from "@/lib/lesson-chunks";

// Self-contained excerpt — never links to /learn, per the brief. Used for
// both the "before" step (with a Begin button) and the "after" objection
// on the verdict page (without one, via the `action` slot).
export function MicroLesson({
  lesson,
  action,
}: {
  lesson: MicroLessonContent;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        {lesson.position === "before" ? "Before you argue" : "After you argue"}
      </p>
      <h2 className="font-serif text-lg font-medium text-ink">{lesson.title}</h2>
      <div className="prose-reading mt-5">
        {lesson.body.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      {/* A citation is not a measured value, so it is not mono, and it
          does not need an em dash in front of it to be recognised as one. */}
      <p className="mt-4 text-sm text-ink-soft">
        {lesson.source.author}, {lesson.source.work}, {lesson.source.section}
      </p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
