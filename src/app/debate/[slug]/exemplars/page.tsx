import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { SamplePageMarker } from "@/components/sample/SamplePageMarker";
import { TextLink } from "@/components/ui/TextLink";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getExemplars } from "@/lib/exemplars";
import { schoolColourVar, schoolName } from "@/lib/school-registry";
import { SAMPLE_PAGE_REFERRER } from "@/lib/sample";
import { SHOWN_SCHOOL_IDS } from "@/lib/types";

// "Exemplar ways to argue this motion": the heading is Arthur's, and so is
// one per opening line with the line under it saying where they come from
// (2026-11-06). Sample accounts' published arguments only, never a real
// reader's (src/lib/exemplars.ts), grouped by school, each opening to its
// full text. Not shown on the motion's own page, where a reader writes
// theirs.
//
// Built on first request and then at most hourly (the sample run adds
// arguments every six hours). generateStaticParams returning nothing is
// what makes a dynamic segment cacheable; `revalidate` alone left the
// route rendered on every request.
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

// It shows sample accounts' arguments, so it is a sample page to analytics
// and passes no referrer on, as every other page showing a sample does
// (docs/sample-activity.md, "What a sample can never touch"): no event, and
// no session replay of the text, reaches PostHog from it.
export const metadata = {
  title: "Exemplar ways to argue this motion · Sophecs",
  description: "Exemplar ways to argue this motion, from each school.",
  referrer: SAMPLE_PAGE_REFERRER,
};

export default async function ExemplarsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Not a motion's slug in shape: not found without a database read.
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug) || !isAdminConfigured()) notFound();
  const admin = createAdminClient();
  const { data: topic, error } = await admin
    .from("debate_topics")
    .select("slug, motion, active")
    .eq("slug", slug)
    .maybeSingle();
  // A failed read is not "no such motion": thrown, so a cached page keeps
  // serving rather than being replaced by a not-found for an hour.
  if (error) {
    console.error(`[exemplars] motion ${slug} could not be read:`, error.message);
    throw new Error(`exemplars: motion ${slug} could not be read`);
  }
  if (!topic || !topic.active) notFound();

  const bySchool = await getExemplars(admin, topic.slug as string, topic.motion as string, SHOWN_SCHOOL_IDS);
  const groups = SHOWN_SCHOOL_IDS.map((school) => ({ school, items: bySchool.get(school) ?? [] })).filter(
    (g) => g.items.length > 0
  );
  // No sample arguments, as after the launch teardown until a fresh run:
  // not a page of headings with nothing under them.
  if (groups.length === 0) notFound();

  return (
    <Page width="read">
      <SamplePageMarker />
      <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink">
        Exemplar ways to argue this motion
      </h1>
      <p className="mt-2 text-sm text-ink-mid">Written as examples for Sophecs.</p>
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
            {/* Keyed by position, so no sample debate's id is in the page. */}
            {items.map((item, i) => (
              <li key={i}>
                <details className="rounded-card border-2 border-rule bg-surface px-4 py-3">
                  <summary className="cursor-pointer font-serif text-base leading-relaxed text-ink">
                    {item.opening}
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
