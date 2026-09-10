import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllMicroLessons, getMicroLesson } from "@/lib/micro-lessons";
import { MicroLesson } from "@/components/debate/MicroLesson";

export function generateStaticParams() {
  return getAllMicroLessons().map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getMicroLesson(slug);
  if (!lesson) return { title: "Sophecs" };
  return {
    title: `${lesson.title} · Sophecs`,
    description: `${lesson.source.author}, ${lesson.source.work}`,
  };
}

// The standalone read of an excerpt. MicroLesson itself is reused unchanged
// and stays free of outbound links, per the brief's rule that a lesson is a
// self-contained excerpt rather than a teaser for a course.
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getMicroLesson(slug);
  if (!lesson) notFound();

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <MicroLesson lesson={lesson} />

        <div className="mt-12 border-t border-rule pt-8 flex flex-wrap items-center gap-6">
          <Link
            href={`/debate/${lesson.topic}`}
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85"
          >
            Argue this motion
          </Link>
          <Link
            href="/lessons"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            All lessons
          </Link>
        </div>
      </div>
    </main>
  );
}
