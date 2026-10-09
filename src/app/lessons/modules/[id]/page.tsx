import { notFound } from "next/navigation";
import Link from "next/link";
import { Passage, type RailEntry } from "@/components/lessons/Passage";
import { ReadingTopBar } from "@/components/lessons/ReadingTopBar";
import { getAllModules, getModule } from "@/lib/modules";
import { getAllTopicFiles } from "@/lib/topics";
import { readingMinutes } from "@/lib/footnotes";
import { SCHOOL_COLORS } from "@/lib/school-colors";

export function generateStaticParams() {
  return getAllModules().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = getModule(id);
  if (!mod) return { title: "Sophecs" };
  return { title: `${mod.title} · Sophecs`, description: mod.quiz_excerpt };
}

// The reading view for a module: one school, one long passage, and the
// motions it prepares you for.
//
// No reading counter in the bar and no "Next reading" at the foot, because a
// module is a single body of text until it is split into an ordered
// sequence. Both appear the moment there is a sequence to count.
export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = getModule(id);
  if (!mod) notFound();

  const topics = getAllTopicFiles().filter((t) => mod.debate_topics.includes(t.slug));

  const rail: RailEntry[] = [
    { id: "passage", label: "The module" },
    { id: "sources", label: "Sources" },
    ...(topics.length > 0 ? [{ id: "argue", label: "Motions it prepares" }] : []),
  ];

  return (
    <div data-daily-path className="flex min-h-screen flex-col">
      <ReadingTopBar width="ui" />

      <div className="mx-auto w-full max-w-ui flex-1 px-6 pb-12">
        <article className="rounded-panel border-2 border-rule bg-surface p-6 sm:p-10">
          <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
            {SCHOOL_COLORS[mod.school].name}
          </p>
          <h1 className="mt-3 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
            {mod.title}
          </h1>
          <p className="mt-3 text-sm text-ink-mid">
            <span className="font-mono tabular">{readingMinutes(mod.body)}</span> min
          </p>

          <Passage
            className="mt-8"
            storageKey={`module:${mod.id}`}
            body={mod.body}
            sources={mod.sources}
            rail={rail}
          >
            {topics.length > 0 && (
              <section id="argue" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
                <h2 className="text-lg font-extrabold tracking-tight text-ink">
                  Motions this prepares you for
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {topics.map((topic) => (
                    <li key={topic.slug}>
                      <Link
                        href={`/debate/${topic.slug}`}
                        className="block rounded-card border-2 border-rule bg-paper px-5 py-4"
                      >
                        <strong className="text-base font-bold text-ink">{topic.title}</strong>
                        <span className="mt-1 block max-w-[60ch] font-serif text-md leading-relaxed text-ink-mid">
                          {topic.motion}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Passage>
        </article>
      </div>
    </div>
  );
}
