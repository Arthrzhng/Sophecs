import Link from "next/link";
import { getAllMicroLessons } from "@/lib/micro-lessons";

export const metadata = {
  title: "Lessons · Sophecs",
  description:
    "The primary-source excerpts behind each motion — one before you argue, one objection after.",
};

// Static: reads content/micro/ at build time, same as /s/[school] reads
// content/schools/. Empty until the micro-lesson files are written.
export default function LessonsPage() {
  const lessons = getAllMicroLessons();

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <p className="eyebrow text-ink-soft mb-4">Lessons</p>
        <h1 className="font-serif text-2xl font-medium">The passages behind the motions</h1>
        <p className="mt-4 text-ink-mid leading-relaxed max-w-[54ch]">
          Every motion comes with two short excerpts: one that frames the
          question before you argue, and one that puts the strongest objection
          to you afterwards. They live here too, so you can find one again.
        </p>

        {lessons.length === 0 ? (
          <div className="mt-10 border-t border-rule pt-8">
            <p className="text-ink-mid text-sm max-w-[50ch]">
              Still developing — the excerpts are being written. In the
              meantime, the three schools are worth reading in full.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 font-mono text-xs">
              <Link href="/s/stoicism" className="text-ink-mid hover:text-ink underline underline-offset-4">
                Stoicism
              </Link>
              <Link href="/s/utilitarianism" className="text-ink-mid hover:text-ink underline underline-offset-4">
                Utilitarianism
              </Link>
              <Link href="/s/virtue-ethics" className="text-ink-mid hover:text-ink underline underline-offset-4">
                Virtue Ethics
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-rule border-t border-rule">
            {lessons.map((lesson) => (
              <li key={lesson.slug} className="py-6">
                <Link href={`/lessons/${lesson.slug}`} className="block group">
                  <p className="eyebrow-sm text-ink-soft mb-1">
                    {lesson.position === "before" ? "Before you argue" : "The objection"}
                  </p>
                  <h2 className="font-serif text-lg font-medium group-hover:underline underline-offset-4">
                    {lesson.title}
                  </h2>
                  <p className="mt-2 font-mono text-xs text-ink-soft">
                    {lesson.source.author}, {lesson.source.work}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
