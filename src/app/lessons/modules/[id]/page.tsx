import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { Passage, type RailEntry } from "@/components/lessons/Passage";
import { getAllModules, getModule } from "@/lib/modules";
import { getAllTopicFiles } from "@/lib/topics";
import { readingMinutes } from "@/lib/footnotes";
import { SCHOOL_COLORS } from "@/lib/school-colors";

export function generateStaticParams() {
  return getAllModules().map((module) => ({ id: module.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const module = getModule(id);
  if (!module) return { title: "Sophecs" };
  return { title: `${module.title} · Sophecs`, description: module.quiz_excerpt };
}

// The reading view for a module. Zero modules exist today, so this route
// generates no paths and costs nothing; it is here so that dropping a file
// into content/modules/ is the whole of adding one.
export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const module = getModule(id);
  if (!module) notFound();

  const topics = getAllTopicFiles().filter((t) => module.debate_topics.includes(t.slug));

  const rail: RailEntry[] = [
    { id: "passage", label: "The module" },
    { id: "sources", label: "Sources" },
    ...(topics.length > 0 ? [{ id: "argue", label: "Motions it prepares" }] : []),
  ];

  return (
    <Page width="ui">
      <p className="text-sm text-ink-soft">{SCHOOL_COLORS[module.school].name}</p>
      <h1 className="mt-1 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
        {module.title}
      </h1>
      <p className="mt-3 text-sm text-ink-mid">
        <span className="font-mono tabular">{readingMinutes(module.body)}</span> min
      </p>

      <div className="mt-10">
        <Passage
          storageKey={`module:${module.id}`}
          body={module.body}
          sources={module.sources}
          rail={rail}
        >
          {topics.length > 0 && (
            <section id="argue" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
              <p className="text-sm text-ink-soft">Motions this prepares you for</p>
              <ul className="mt-4 space-y-4">
                {topics.map((topic) => (
                  <li key={topic.slug}>
                    <TextLink href={`/debate/${topic.slug}`} className="font-serif text-md">
                      {topic.title}
                    </TextLink>
                    <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
                      {topic.motion}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm" data-print="hide">
                <TextLink href="/lessons">All lessons</TextLink>
              </p>
            </section>
          )}
        </Passage>
      </div>
    </Page>
  );
}
