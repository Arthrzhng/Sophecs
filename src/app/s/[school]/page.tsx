import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

const VALID_SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

export function generateStaticParams() {
  return VALID_SCHOOLS.map((school) => ({ school }));
}

export async function generateMetadata({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  if (!VALID_SCHOOLS.includes(school as SchoolId)) return { title: "Sophecs" };
  const content = getSchool(school as SchoolId);
  return { title: `${content.name} · Sophecs`, description: content.one_line };
}

export default async function SchoolPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  if (!VALID_SCHOOLS.includes(school as SchoolId)) notFound();

  const content = getSchool(school as SchoolId);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-16 pb-24">
        <p className="eyebrow text-ink-soft mb-4">{content.name}</p>
        <blockquote className="font-serif text-2xl sm:text-[28px] font-medium leading-snug italic">
          &ldquo;{content.one_line}&rdquo;
        </blockquote>
        <p className="mt-2 font-mono text-xs text-ink-soft">— {content.one_line_attribution}</p>

        <div className="mt-10 prose-reading">
          {content.read.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-12 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-4">What {content.name.toLowerCase()} gets wrong</p>
          <div className="prose-reading">
            {content.gets_wrong.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Link
            href="/quiz"
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85 transition-opacity"
          >
            Take the quiz
          </Link>
          <Link
            href="/debate"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Argue a motion from it
          </Link>
        </div>

        <div className="mt-12 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-3">The other two</p>
          <div className="flex flex-wrap gap-6 text-sm">
            {VALID_SCHOOLS.filter((id) => id !== school).map((id) => (
              <Link
                key={id}
                href={`/s/${id}`}
                className="text-ink-mid hover:text-ink underline underline-offset-4"
              >
                {getSchool(id).name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
