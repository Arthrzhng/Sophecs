import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { ButtonLink } from "@/components/ui/Button";
import { Passage } from "@/components/lessons/Passage";
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

  const sibling =
    getAllMicroLessons().find(
      (l) => l.topic === lesson.topic && l.position !== lesson.position
    ) ?? null;
  const topic = getAllTopicFiles().find((t) => t.slug === lesson.topic) ?? null;

  return (
    <Page width="ui">
      <p className="text-sm text-ink-soft">
        {lesson.position === "before" ? "Before you argue" : "After you argue"}
      </p>
      <h1 className="mt-1 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
        {lesson.title}
      </h1>
      {/* Reading time only. The citation is four paragraphs below under
          Sources, and printing it twice on a page this short is the kind of
          repetition that reads as padding. */}
      <p className="mt-3 text-sm text-ink-mid">
        <span className="font-mono tabular">{readingMinutes(lesson.body)}</span> min
      </p>

      <div className="mt-10">
        {/* No rail and no remembered position. A micro-passage is four
            paragraphs — a contents list for a page you can already see, and
            a saved scroll position cannot return you anywhere you had not
            already reached. Both belong to modules, which are long. */}
        <Passage body={lesson.body} sources={[lesson.source]}>
          {sibling && (
            <section id="next" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
              <p className="text-sm text-ink-soft">
                {sibling.position === "after"
                  ? "The objection to this, from another school"
                  : "The passage that frames the question"}
              </p>
              <p className="mt-2">
                <TextLink href={`/lessons/${sibling.slug}`} className="font-serif text-md">
                  {sibling.title}
                </TextLink>
              </p>
              <p className="mt-1 text-sm text-ink-soft">{formatSource(sibling.source)}</p>
            </section>
          )}

          <section id="argue" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
            {topic && (
              <p className="max-w-[60ch] font-serif text-md leading-relaxed text-ink">
                {topic.motion}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-6" data-print="hide">
              <ButtonLink href={`/debate/${lesson.topic}`}>Argue this motion</ButtonLink>
              <TextLink href="/lessons" className="text-sm">
                All lessons
              </TextLink>
            </div>
          </section>
        </Passage>
      </div>
    </Page>
  );
}
