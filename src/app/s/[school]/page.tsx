import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { notFound } from "next/navigation";
import { getSchool } from "@/lib/schools";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SCHOOL_IDS, type SchoolId } from "@/lib/types";

export function generateStaticParams() {
  return SCHOOL_IDS.map((school) => ({ school }));
}

export async function generateMetadata({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  if (!SCHOOL_IDS.includes(school as SchoolId)) return { title: "Sophecs" };
  const content = getSchool(school as SchoolId);
  return { title: `${content.name} · Sophecs`, description: content.one_line };
}

/**
 * One school, led by what it says.
 *
 * The page a share card lands on, so the quotation is the first thing on
 * it. On white, though, and not on a filled school-coloured panel: a
 * saturated surface here would echo the result card, which is the one
 * poster in the product and earns that treatment by being the thing people
 * share. The school's colour is a 4px left edge instead, which is the
 * marker rule's own form (design/tokens.md §1) and leaves the card reading
 * as a page rather than as a second card.
 *
 * Still static. Nothing here is read from a session, and the links are the
 * three the page already had: the quiz, the arena, and the other two
 * schools. A redraw, not a new information architecture.
 *
 * The container is written out rather than taken from <Page>, because the
 * wrapper has to sit on <main>. /today and /table do the same for the same
 * reason; all three go back to <Page> in the stage that deletes the
 * wrapper and promotes the font and the radius.
 */
export default async function SchoolPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  if (!SCHOOL_IDS.includes(school as SchoolId)) notFound();

  const id = school as SchoolId;
  const content = getSchool(id);
  const tone = SCHOOL_CHUNKY[id];
  const others = SCHOOL_IDS.filter((other) => other !== id);

  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="read" rhythm="path">
        {/* The left edge is the only school colour on the page. 2px
            elsewhere; 4px here because this is the one surface whose whole
            job is to say which school you are looking at. */}
        <section
          className="rounded-card border-2 border-l-4 border-rule bg-surface p-6"
          style={{ borderLeftColor: tone.bg }}
        >
          {/* The quotation leads, because it is what the share card
              promised whoever followed it. Ink on white: the name below
              identifies the school, so the colour does not have to. */}
          <blockquote className="font-serif text-lg font-medium leading-snug text-ink sm:text-xl">
            &ldquo;{content.one_line}&rdquo;
          </blockquote>
          <p className="mt-3 text-sm text-ink-mid">{content.one_line_attribution}</p>
          <h1 className="mt-5 text-lg font-extrabold tracking-tight text-ink">
            {content.name}
          </h1>
        </section>

        <div className="prose-reading mt-10">
          {content.read.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {/* A card rather than a hairline-topped section: this is the other
            two schools talking, not the next part of the same voice, and
            the border is what says so. */}
        <section className="mt-12 rounded-card border-2 border-rule bg-surface p-6">
          {/* The name as it is written, not lowercased. The old page
              lowercased it to read as mid-sentence, which turned three
              proper nouns into "what stoicism gets wrong" and, worse,
              "what virtue ethics gets wrong". */}
          <h2 className="text-base font-extrabold text-ink">
            What {content.name} gets wrong
          </h2>
          <div className="prose-reading mt-4">
            {content.gets_wrong.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="mt-12 flex flex-wrap items-center gap-6">
          <ChunkyLink href="/quiz" school={id}>
            Take the quiz
          </ChunkyLink>
          <Link
            href="/debate"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
          >
            Argue a motion from it
          </Link>
        </section>

        <section className="mt-12 border-t-2 border-rule pt-8">
          <h2 className="text-base font-extrabold text-ink">The other two</h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2">
            {others.map((other) => {
              const that = getSchool(other);
              return (
                <li key={other} className="flex">
                  <Link
                    href={`/s/${other}`}
                    className="chunky flex min-w-0 flex-1 flex-col gap-2 rounded-card border-2 border-rule-strong bg-surface p-5"
                    style={shade("var(--color-rule-strong)")}
                  >
                    {/* Ink, not the other school's colour. The markers are
                        for a 2px rule, an underline, a filled card or text
                        at 24px and up, and never for a link; these cards
                        are links at 16px. The page's colour is its own. */}
                    <span className="text-base font-extrabold text-ink">{that.name}</span>
                    <span className="font-serif text-base leading-relaxed text-ink-mid">
                      &ldquo;{that.one_line}&rdquo;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
    </Page>
  );
}
