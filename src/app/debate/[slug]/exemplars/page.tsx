import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getExemplars, openingOf } from "@/lib/exemplars";
import { schoolColourVar, schoolName } from "@/lib/school-registry";
import { SHOWN_SCHOOL_IDS } from "@/lib/types";

// "Exemplar ways to argue this motion" (Arthur, 2026-11-06): the strongest
// sample arguments on a motion, grouped by school, each opening to its
// full text. The heading is what tells a reader what they are; the
// arguments come from sample accounts only, never a real reader's
// (src/lib/exemplars.ts). Public, unlike the motion's own page, which is
// where a reader writes theirs and so shows none of these.
//
// Rebuilt at most hourly: the sample run adds arguments every six hours.
export const revalidate = 3600;

export const metadata = { title: "Exemplar ways to argue this motion · Sophecs" };

export default async function ExemplarsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();
  const { data: topic } = await admin
    .from("debate_topics")
    .select("slug, motion, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!topic || !topic.active) notFound();

  const bySchool = await getExemplars(admin, topic.slug as string, SHOWN_SCHOOL_IDS);
  const groups = SHOWN_SCHOOL_IDS.map((school) => ({ school, items: bySchool.get(school) ?? [] })).filter(
    (g) => g.items.length > 0
  );

  return (
    <Page width="read">
      <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink">
        Exemplar ways to argue this motion
      </h1>
      <p className="mt-4 font-serif text-md leading-relaxed text-ink">{topic.motion as string}</p>
      <p className="mt-4">
        <TextLink href={`/debate/${topic.slug}`} className="text-sm font-semibold">
          Argue this motion
        </TextLink>
      </p>

      {groups.map(({ school, items }) => (
        <section key={school} className="mt-10 border-t-2 border-rule pt-6">
          <h2 className="inline-flex items-center gap-3 text-lg font-extrabold tracking-tight text-ink">
            <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full" style={{ background: schoolColourVar(school) }} />
            {schoolName(school)}
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <details className="rounded-card border-2 border-rule bg-surface px-4 py-3">
                  <summary className="cursor-pointer font-serif text-base leading-relaxed text-ink">
                    {openingOf(item.argument)}
                  </summary>
                  <div className="prose-reading mt-3 text-ink">
                    {item.argument.split(/\n\s*\n/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Page>
  );
}
