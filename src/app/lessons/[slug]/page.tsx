import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { ButtonLink } from "@/components/ui/Button";
import { Passage, type RailEntry } from "@/components/lessons/Passage";
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

  // The rail lists what is actually on this page.
  //
  // The approved wireframe showed section headings from inside the passage
  // ("The sorting", "What you own"). There are none: a micro-lesson body is
  // four unheaded paragraphs, and content/ is frozen, so inventing three
  // headings per passage would be writing content under the guise of
  // layout. These four anchors are real.
  const rail: RailEntry[] = [
    { id: "passage", label: "The passage" },
    { id: "sources", label: "Sources" },
    ...(sibling
      ? [
          {
            id: "next",
            label: sibling.position === "after" ? "The objection" : "Before you argue",
          },
        ]
      : []),
    { id: "argue", label: "Argue this motion" },
  ];

  return (
    <Page width="ui">
      <p className="text-sm text-ink-soft">
        {lesson.position === "before" ? "Before you argue" : "After you argue"}
      </p>
      <h1 className="mt-1 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
        {lesson.title}
      </h1>
      <p className="mt-3 text-sm text-ink-mid">
        {formatSource(lesson.source)} —{" "}
        <span className="font-mono tabular">{readingMinutes(lesson.body)}</span> min
      </p>

      <div className="mt-10">
        <Passage
          storageKey={lesson.slug}
          body={lesson.body}
          sources={[lesson.source]}
          rail={rail}
        >
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
