import type { MicroLessonContent } from "@/lib/micro-lessons";

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
      <p className="eyebrow text-ink-soft mb-4">
        {lesson.position === "before" ? "Before you argue" : "The objection"}
      </p>
      <h1 className="font-serif text-2xl font-medium">{lesson.title}</h1>
      <div className="mt-6 prose-reading">
        {lesson.body.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-ink-soft">
        — {lesson.source.author}, {lesson.source.work}, {lesson.source.section}
      </p>
      {action && <div className="mt-10">{action}</div>}
    </div>
  );
}
