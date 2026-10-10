import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleFilter, type ModuleCard } from "@/components/lessons/ModuleFilter";
import { getAllMicroLessons } from "@/lib/micro-lessons";
import { getAllTopicFiles } from "@/lib/topics";
import { getAllModules } from "@/lib/modules";
import { splitModule } from "@/lib/module-readings";
import { authorList, moduleNumbers } from "@/lib/lesson-index";
import { SCHOOL_IDS } from "@/lib/footnotes";
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
// Two kinds of reading, in the order the mockup puts them. Modules are
// cards, one per school, filtered by the chips. The per-motion passages are
// rows, grouped by motion rather than listed as twelve loose passages: a
// passage on its own is an excerpt, and the pair is the shape of the
// argument — the question, then the objection.
export default function LessonsPage() {
  const lessons = getAllMicroLessons();
  const topics = getAllTopicFiles()
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort);

  // School order, not filename order: the chips run Stoicism, Utilitarianism,
  // Virtue Ethics, and cards in a different order is a disagreement with
  // nothing behind it.
  const modules = getAllModules().sort(
    (a, b) => SCHOOL_IDS.indexOf(a.school) - SCHOOL_IDS.indexOf(b.school)
  );
  const numbers = moduleNumbers(modules);

  const cards: ModuleCard[] = modules.map((m) => ({
    id: m.id,
    school: m.school,
    title: m.title,
    excerpt: m.quiz_excerpt,
    numberInSchool: numbers[m.id],
    // Counted by the same function the module page splits with, so the card
    // and the bar on that page can never disagree about how many there are.
    readings: splitModule(m.title, m.body, m.readings).length,
    sources: authorList(m.sources),
  }));

  const byTopic = new Map<string, { before?: MicroLessonContent; after?: MicroLessonContent }>();
  for (const lesson of lessons) {
    const entry = byTopic.get(lesson.topic) ?? {};
    entry[lesson.position] = lesson;
    byTopic.set(lesson.topic, entry);
  }

  const grouped = topics
    .map((topic) => ({ topic, ...(byTopic.get(topic.slug) ?? {}) }))
    .filter((g) => g.before || g.after);

  const heading = (
    <>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Lessons</h1>
      <p className="mt-1 text-base text-ink-mid">Primary sources, open to every school.</p>
    </>
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-ui px-6 py-10">
        {cards.length > 0 ? (
          <ModuleFilter heading={heading} modules={cards} />
        ) : (
          <div>{heading}</div>
        )}

        {grouped.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title="The passages are still being written."
              body="Until they land, the case for each school is the thing worth reading — each one is a few hundred words with its own primary source."
              action={
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  {SCHOOL_IDS.map((school) => (
                    <Link
                      key={school}
                      href={`/s/${school}`}
                      className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4"
                    >
                      {SCHOOL_COLORS[school].name}
                    </Link>
                  ))}
                </div>
              }
            />
          </div>
        ) : (
          <section className="mt-12">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">
              Short readings by motion
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {grouped.map(({ topic, before, after }) => {
                const pair = [before, after].filter(Boolean) as MicroLessonContent[];
                // The row opens on the first of the pair; that reading links
                // its sibling, so one row still reaches both.
                const first = pair[0];
                const authors = authorList(pair.map((l) => l.source));
                return (
                  <li key={topic.slug}>
                    <Link
                      href={`/lessons/${first.slug}`}
                      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-card border-2 border-rule bg-surface px-5 py-4"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <strong className="text-base font-bold text-ink">
                          {topic.title}
                          {/* Only when both halves are there, which is the
                              whole of what the phrase claims. */}
                          {pair.length === 2 && <> &middot; before and after readings</>}
                        </strong>
                        <span className="text-sm text-ink-mid">
                          <span className="font-mono tabular">{pair.length}</span>{" "}
                          {pair.length === 1 ? "reading" : "readings"}
                          {authors && <> &middot; {authors}</>}
                        </span>
                      </span>
                      {/* Ink, not the mockup's green: a motion belongs to no
                          school, and the only green in this product means
                          Stoicism. */}
                      <span className="text-sm font-extrabold tracking-wide uppercase text-ink">
                        Read
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
