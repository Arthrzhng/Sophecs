import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { LandingQuestion } from "@/components/quiz/LandingQuestion";
import { getSchool } from "@/lib/schools";
import { getAllTopicFiles } from "@/lib/topics";
import type { SchoolId } from "@/lib/types";

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// The landing page opens with question one, live.
//
// It used to open with a headline describing the quiz and a button to reach
// it, which is the shape of every generated landing page and costs a tap on
// the only path that matters. A visitor now answers where they land. There
// is no hero, no feature grid, no testimonials, no stats block — below the
// question are the three schools as they actually are, one real motion, and
// the footer.
export default function LandingPage() {
  // The lowest-sorted active motion, read from the content files rather than
  // the database so the landing page never depends on Supabase being
  // reachable and stays statically rendered.
  const motion = getAllTopicFiles()
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort)[0];

  return (
    <Page width="read" tight>
      {/* One short line, not a hero. The question underneath is the page. */}
      <h1 className="text-base text-ink-mid">
        Ten questions on how AI should decide things.
      </h1>
      <div className="mt-5">
        <LandingQuestion />
      </div>

      {/* Below the question, not above it. This is reassurance, and putting
          it first cost the third answer row its place above the fold on a
          360x640 screen. Was mono; neither sentence is a measured value, so
          it is Plex Sans at the small step. */}
      <p className="mt-5 text-sm text-ink-soft">
        About 80 seconds. Nothing is saved unless you share it.
      </p>

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="font-serif text-lg font-medium text-ink">The three schools</h2>
        {/*
          Three columns of real quotation with real citation — a table of
          contents, not the three feature cards the brief rules out. No
          borders, no icons, no heading-plus-blurb.
        */}
        <ul className="mt-6 grid gap-8 sm:grid-cols-3">
          {SCHOOLS.map((id) => {
            const school = getSchool(id);
            return (
              <li key={id}>
                <h3 className="font-serif text-base font-medium text-ink">
                  <TextLink href={`/s/${id}`}>{school.name}</TextLink>
                </h3>
                <p className="mt-2 font-serif text-base leading-relaxed text-ink-mid">
                  &ldquo;{school.one_line}&rdquo;
                </p>
                <p className="mt-2 text-sm text-ink-soft">{school.one_line_attribution}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {motion && (
        <section className="mt-12 border-t border-rule pt-8">
          <h2 className="font-serif text-lg font-medium text-ink">A motion you could argue</h2>
          <p className="mt-4 max-w-[66ch] font-serif text-md leading-relaxed text-ink">
            {motion.motion}
          </p>
          <p className="mt-4 text-sm text-ink-mid">
            <TextLink href={`/debate/${motion.slug}`}>Read the motion</TextLink>
          </p>
        </section>
      )}
    </Page>
  );
}
