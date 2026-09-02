import Link from "next/link";
import { notFound } from "next/navigation";
import { SchoolEyebrow } from "@/components/school-mark";
import { getAllModules, getModule } from "@/lib/content";

export function generateStaticParams() {
  return getAllModules().map((mod) => ({ slug: mod.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  return { title: mod ? `${mod.title} · Sophecs` : "Sophecs" };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  const sources = (
    <ol className="space-y-3">
      {mod.sources.map((source, i) => (
        <li key={source.name} className="font-mono text-xs leading-relaxed text-ink-mid">
          <span className="text-ink-soft">{i + 1}</span> {source.name}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto max-w-5xl px-5 pt-14">
      {/* Mobile: sources as a collapsed strip above the title. */}
      <details className="lg:hidden border border-rule rounded-btn bg-surface px-4 py-3 mb-8">
        <summary className="eyebrow-sm text-ink-mid cursor-pointer select-none">
          Sources ({mod.sources.length})
        </summary>
        <div className="pt-4">{sources}</div>
      </details>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">
        {/* Desktop: sticky numbered rail on the left. */}
        <aside className="hidden lg:block">
          <div className="sticky top-10">
            <p className="eyebrow-sm text-ink-soft mb-4">Sources</p>
            {sources}
          </div>
        </aside>

        <article className="pb-4">
          <SchoolEyebrow school={mod.school_id} />
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-medium leading-[1.2] tracking-tight max-w-[63ch]">
            {mod.title}
          </h1>

          <div className="mt-10">
            {mod.sections.map((section, i) => (
              <section key={i} className={i > 0 ? "mt-12" : undefined}>
                {section.heading && (
                  <h2 className="eyebrow text-ink-mid mb-5">
                    {section.heading}
                  </h2>
                )}
                {section.blocks.map((block, j) =>
                  block.kind === "pull" ? (
                    <blockquote
                      key={j}
                      className="my-8 font-serif italic text-[22px] leading-[1.5] text-ink border-y border-rule py-6 max-w-[52ch]"
                    >
                      {block.text}
                    </blockquote>
                  ) : (
                    <p
                      key={j}
                      className={`prose-reading ${j > 0 ? "mt-5" : ""}`}
                    >
                      {block.text}
                    </p>
                  )
                )}
              </section>
            ))}
          </div>

          {/* The only place lessons point at the arena; nothing links back. */}
          <aside className="mt-16 border border-rule rounded-btn bg-surface p-7 max-w-[63ch]">
            <p className="eyebrow text-ink-soft">Argue this</p>
            <ul className="mt-4 space-y-4">
              {mod.debate_topics.map((topic) => (
                <li key={topic.id}>
                  <p className="font-serif text-[18px] leading-snug">{topic.text}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/debate"
              className="mt-6 inline-block bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85"
            >
              Take it to the arena
            </Link>
          </aside>
        </article>
      </div>
    </div>
  );
}
