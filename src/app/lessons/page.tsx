import Link from "next/link";
import { SchoolDot } from "@/components/school-mark";
import { getAllModules } from "@/lib/content";
import { schoolName } from "@/lib/schools";

export const metadata = { title: "Lessons · Sophecs" };

// The one-line description is the first sentence of the module's
// quiz_excerpt, so the index needs nothing beyond the fixed frontmatter.
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : text;
}

// Lessons are public and never gated by school.
export default function LessonsPage() {
  const modules = getAllModules();

  return (
    <div className="mx-auto max-w-4xl px-5 pt-14">
      <h1 className="font-serif text-3xl font-medium">Lessons</h1>
      <p className="mt-3 text-ink-mid max-w-[55ch] leading-relaxed">
        Three modules, each written from its school&apos;s primary sources.
        All of them are open to everyone, whichever school claimed you.
      </p>

      <div className="mt-12">
        {modules.map((mod) => (
          <article
            key={mod.slug}
            className="border-t border-rule py-8 grid md:grid-cols-[1fr_260px] gap-x-12 gap-y-4"
          >
            <div>
              <p className="flex items-center gap-2 eyebrow text-ink-mid">
                <SchoolDot school={mod.school_id} />
                {schoolName(mod.school_id)}
              </p>
              <h2 className="mt-3 font-serif text-2xl font-medium leading-snug">
                <Link
                  href={`/lessons/${mod.slug}`}
                  className="hover:underline underline-offset-4"
                >
                  {mod.title}
                </Link>
              </h2>
              <p className="mt-3 text-ink-mid leading-relaxed max-w-[55ch]">
                {firstSentence(mod.quiz_excerpt)}
              </p>
            </div>
            <div className="md:border-l md:border-rule md:pl-8">
              <p className="eyebrow-sm text-ink-soft mb-3">Sources</p>
              <ol className="space-y-2">
                {mod.sources.map((source, i) => (
                  <li
                    key={source.name}
                    className="font-mono text-xs text-ink-mid leading-relaxed"
                  >
                    <span className="text-ink-soft">{i + 1}</span>{" "}
                    {source.name}
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
