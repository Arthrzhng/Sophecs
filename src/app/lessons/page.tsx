import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { getAllTopicFiles } from "@/lib/topics";
import { getAllModules } from "@/lib/modules";
import { formatSource, readingMinutes } from "@/lib/footnotes";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { MicroLessonContent } from "@/lib/lesson-chunks";

export const metadata = {
  title: "Lessons · Sophecs",
  description:
    "The primary-source passages behind each motion — one that frames the question before you argue, one that puts the strongest objection to you afterwards.",
};

// Static: reads content/micro/, content/topics/ and content/modules/ at
// build time, the same way /s/[school] reads content/schools/.
//
// Grouped by topic rather than listed as twelve loose passages. A passage
// on its own is an excerpt; the pair is the shape of the argument — the
// question, then the objection — and that pairing is the only reason the
// second one lands.
export default function LessonsPage() {
  const lessons = getAllMicroLessons();
  const topics = getAllTopicFiles()
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort);
  const modules = getAllModules();

  const byTopic = new Map<string, { before?: MicroLessonContent; after?: MicroLessonContent }>();
  for (const lesson of lessons) {
    const entry = byTopic.get(lesson.topic) ?? {};
    entry[lesson.position] = lesson;
    byTopic.set(lesson.topic, entry);
  }

  const grouped = topics
    .map((topic) => ({ topic, ...(byTopic.get(topic.slug) ?? {}) }))
    .filter((g) => g.before || g.after);

  return (
    <Page width="read">
      <h1 className="font-serif text-lg font-medium text-ink">Lessons</h1>
      <p className="mt-3 max-w-[66ch] text-sm leading-relaxed text-ink-mid">
        Every motion comes with two short passages from primary sources: one
        that frames the question before you argue, and one that puts the
        strongest objection to you afterwards. They live here too, so you can
        find one again without starting a debate.
      </p>

      {grouped.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="The passages are still being written."
            body="Until they land, the case for each school is the thing worth reading — each one is a few hundred words with its own primary source."
            action={
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <TextLink href="/s/stoicism">Stoicism</TextLink>
                <TextLink href="/s/utilitarianism">Utilitarianism</TextLink>
                <TextLink href="/s/virtue-ethics">Virtue Ethics</TextLink>
              </div>
            }
          />
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-rule border-t border-rule">
          {grouped.map(({ topic, before, after }) => {
            const bodies = [before?.body, after?.body].filter(Boolean) as string[];
            const count = bodies.length;
            return (
              <li key={topic.slug} className="py-8">
                <h2 className="font-serif text-md font-medium text-ink">{topic.title}</h2>
                <p className="mt-1 text-sm text-ink-mid">
                  {count} {count === 1 ? "passage" : "passages"},{" "}
                  <span className="font-mono tabular">{readingMinutes(...bodies)}</span> min
                </p>

                {/* Sources on the index, not just inside the passage: this
                    is a reading list, and a reading list that hides what it
                    is a list of is a menu. */}
                <ul className="mt-4 space-y-3 border-l border-rule pl-4">
                  {[before, after].filter(Boolean).map((lesson) => (
                    <li key={lesson!.slug}>
                      <TextLink href={`/lessons/${lesson!.slug}`} className="text-sm">
                        {lesson!.title}
                      </TextLink>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {lesson!.position === "before" ? "Before you argue" : "After you argue"}
                        {" — "}
                        {formatSource(lesson!.source)}
                      </p>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm">
                  <TextLink href={`/debate/${topic.slug}`}>Argue this motion</TextLink>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Absent until content/modules/ holds a file. The index is complete
          without them; this is the seam they slot into. */}
      {modules.length > 0 && (
        <section className="mt-12 border-t border-rule pt-8">
          <h2 className="font-serif text-md font-medium text-ink">Modules</h2>
          <p className="mt-2 max-w-[66ch] text-sm leading-relaxed text-ink-mid">
            Longer reads, one school at a time, with the motions each one
            prepares you for.
          </p>
          <ul className="mt-6 divide-y divide-rule border-t border-rule">
            {modules.map((module) => (
              <li key={module.id} className="py-6">
                <TextLink href={`/lessons/modules/${module.id}`} className="font-serif text-md">
                  {module.title}
                </TextLink>
                <p className="mt-1 text-sm text-ink-mid">
                  {SCHOOL_COLORS[module.school].name},{" "}
                  <span className="font-mono tabular">{readingMinutes(module.body)}</span> min
                </p>
                <p className="mt-2 max-w-[66ch] text-sm leading-relaxed text-ink-mid">
                  {module.quiz_excerpt}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
