import { notFound } from "next/navigation";
import Link from "next/link";
import { ModuleReader } from "@/components/lessons/ModuleReader";
import type { PassageSection, RailEntry } from "@/components/lessons/Passage";
import { getAllModules, getModule } from "@/lib/modules";
import { splitModule } from "@/lib/module-readings";
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

// The reading view for a module: one school, a sequence of titled readings,
// and the motions it prepares you for. One page per module, as §10 asks —
// the bar counts readings by scroll position, not by navigation.
export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = getModule(id);
  if (!mod) notFound();

  const topics = getAllTopicFiles().filter((t) => mod.debate_topics.includes(t.slug));

  // splitModule is the only way the body is ever divided, so the page, the
  // index's count and the tests cannot disagree about where a reading ends.
  const sections: PassageSection[] = splitModule(mod.title, mod.body, mod.readings).map(
    (reading, i) => ({ id: `reading-${i + 1}`, title: reading.title, paragraphs: reading.paragraphs })
  );

  const rail: RailEntry[] = [
    ...sections.map((section) => ({ id: section.id, label: section.title })),
    { id: "sources", label: "Sources" },
    ...(topics.length > 0 ? [{ id: "argue", label: "Motions it prepares" }] : []),
  ];

  return (
    <ModuleReader
      moduleId={mod.id}
      schoolName={SCHOOL_COLORS[mod.school].name}
      title={mod.title}
      minutes={readingMinutes(mod.body)}
      sections={sections}
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
    </ModuleReader>
  );
}
