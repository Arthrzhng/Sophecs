import Link from "next/link";
import { notFound } from "next/navigation";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";
import { Page } from "@/components/layout/Page";
import { ButtonLink } from "@/components/ui/Button";

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
    <Page width="read">
        <p className="mb-4 text-sm text-ink-soft">{content.name}</p>
        <blockquote className="font-serif text-lg font-medium leading-snug italic text-ink">
          &ldquo;{content.one_line}&rdquo;
        </blockquote>
        <p className="mt-3 text-sm text-ink-soft">{content.one_line_attribution}</p>

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
          <ButtonLink
            href="/quiz"
          >
            Take the quiz
          </ButtonLink>
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
    </Page>
  );
}
