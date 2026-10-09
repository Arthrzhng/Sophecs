import { notFound } from "next/navigation";
import Link from "next/link";
import { Passage } from "@/components/lessons/Passage";
import { ReadingTopBar } from "@/components/lessons/ReadingTopBar";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { getAllMicroLessons, getMicroLesson } from "@/lib/micro-lessons";
import { getAllTopicFiles } from "@/lib/topics";
import { formatSource, readingMinutes } from "@/lib/footnotes";

export function generateStaticParams() {
  return getAllMicroLessons().map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getMicroLesson(slug);
  if (!lesson) return { title: "Sophecs" };
  return {
    title: `${lesson.title} · Sophecs`,
    description: formatSource(lesson.source),
  };
}

// The standalone read of a passage. Self-contained: the only links out are
// to its sibling passage, the motion it belongs to, and the index.
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getMicroLesson(slug);
  if (!lesson) notFound();

  const inTopic = getAllMicroLessons().filter((l) => l.topic === lesson.topic);
  const sibling = inTopic.find((l) => l.position !== lesson.position) ?? null;
  const topic = getAllTopicFiles().find((t) => t.slug === lesson.topic) ?? null;

  // getAllMicroLessons sorts "before" ahead of "after", so a passage's place
  // in its own topic is the reading number. Derived rather than written
  // down: a third passage on a motion would number itself.
  const index = inTopic.findIndex((l) => l.slug === lesson.slug) + 1;

  return (
    <div data-daily-path className="flex min-h-screen flex-col">
      <ReadingTopBar position={{ index, total: inTopic.length }} />

      <div className="mx-auto w-full max-w-read flex-1 px-6 pb-12">
        <article className="rounded-panel border-2 border-rule bg-surface p-6 sm:p-10">
          {topic && (
            <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
              {topic.title}
            </p>
          )}
          <h1 className="mt-3 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
            {lesson.title}
          </h1>
          {/* Where the passage sits in the week, and how long it is. Not the
              citation: that is four paragraphs below under Sources, and
              printing it twice on a page this short reads as padding. */}
          <p className="mt-3 text-sm text-ink-mid">
            {lesson.position === "before" ? "Before you argue" : "After you argue"} &middot;{" "}
            <span className="font-mono tabular">{readingMinutes(lesson.body)}</span> min
          </p>

          {/* No rail and no remembered position. A micro-passage is four
              paragraphs — a contents list for a page you can already see,
              and a saved scroll position cannot return you anywhere you had
              not already reached. Both belong to modules, which are long. */}
          <Passage className="mt-8" body={lesson.body} sources={[lesson.source]}>
            {sibling && (
              <section id="next" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
                <p className="text-sm text-ink-mid">
                  {sibling.position === "after"
                    ? "The objection to this, from another school"
                    : "The passage that frames the question"}
                </p>
                <p className="mt-1">
                  <Link
                    href={`/lessons/${sibling.slug}`}
                    className="inline-flex min-h-11 items-center font-serif text-md font-medium text-ink underline underline-offset-4"
                  >
                    {sibling.title}
                  </Link>
                </p>
                <p className="text-sm text-ink-mid">{formatSource(sibling.source)}</p>
              </section>
            )}

            {topic && (
              <section id="argue" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
                <p className="max-w-[60ch] font-serif text-md leading-relaxed text-ink">
                  {topic.motion}
                </p>
              </section>
            )}
          </Passage>
        </article>
      </div>

      {/* The forward action, in the bar the mockup gives it. `paper` rather
          than a school colour: a motion carries a stance for all three
          schools, so filling this with one would take a side the content
          deliberately does not. */}
      <div className="border-t-2 border-rule" data-print="hide">
        <div className="mx-auto flex w-full max-w-read justify-end px-6 py-5">
          <ChunkyLink href={`/debate/${lesson.topic}`} tone="paper">
            Argue this motion
          </ChunkyLink>
        </div>
      </div>
    </div>
  );
}
