import Link from "next/link";
import { SchoolDot } from "@/components/school-mark";
import { getAllModules } from "@/lib/content";
import { schoolName } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

const SCHOOL_STANCES: Record<SchoolId, string> = {
  stoicism:
    "A model's outputs are caused, and so are yours. What matters is whether they flow through something you can call a constitution.",
  utilitarianism:
    "Count the welfare and the answer falls out. The hard part was never the counting; it was deciding who gets counted.",
  "virtue-ethics":
    "No rule survives contact with the particulars. Judgment does, and judgment is built the way habits are built.",
};

export default function HomePage() {
  const modules = getAllModules();
  const citations = modules.flatMap((mod) => mod.sources.map((s) => s.name));

  return (
    <div className="mx-auto max-w-5xl px-5">
      <section className="pt-20 pb-16 max-w-3xl">
        <p className="eyebrow text-ink-soft mb-5">Philosophy × AI</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium leading-[1.15] tracking-tight">
          Chrysippus never saw a language model. His argument about the
          cylinder still works on one.
        </h1>
        <p className="mt-6 text-lg text-ink-mid leading-relaxed max-w-[55ch]">
          Sophecs sorts you into one of three schools, then makes you defend
          it. A diagnostic quiz, an arena where the motions are about
          machines, and lessons written from the primary sources.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/quiz"
            className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Find your school
          </Link>
          <Link
            href="/lessons"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Read the lessons
          </Link>
        </div>
      </section>

      <section className="border-t border-rule">
        {modules.map((mod) => (
          <article
            key={mod.slug}
            className="grid sm:grid-cols-[220px_1fr] gap-x-10 gap-y-2 py-8 border-b border-rule"
          >
            <h2 className="flex items-center gap-2.5 font-serif text-xl font-medium">
              <SchoolDot school={mod.school_id} />
              {schoolName(mod.school_id)}
            </h2>
            <div>
              <p className="text-ink-mid leading-relaxed max-w-[60ch]">
                {SCHOOL_STANCES[mod.school_id]}
              </p>
              <p className="mt-2 font-serif italic text-ink">
                Open question: {mod.title}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="py-10">
        <p className="eyebrow-sm text-ink-soft mb-4">Argued from</p>
        <ul className="flex flex-wrap gap-2">
          {citations.map((citation) => (
            <li
              key={citation}
              className="font-mono text-xs text-ink-mid border border-rule rounded-btn px-2.5 py-1 bg-surface"
            >
              {citation}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
