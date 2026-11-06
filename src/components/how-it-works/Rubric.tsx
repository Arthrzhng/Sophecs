import { SCHOOL_CHUNKY } from "@/components/daily-path/chunky";
import { FIDELITY_CRITERIA } from "@/lib/judge/rubric";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { PUBLISHED_SCHOOL_IDS } from "@/lib/school-registry";

/**
 * The rubric: the three axes in order of weight, and the fidelity criteria
 * the judge is given for each school. Shared by `/debate/rubric` and, on a
 * SIX_SCHOOLS build, `/how-it-works` (Arthur, 2026-11-06). `sub` sets the
 * headings one level down, where that page puts them under a section of
 * its own; without it the markup is `/debate/rubric`'s as it was.
 *
 * Published because a score nobody can interrogate is a score nobody
 * should trust. Read as a document rather than laid out as a feature page:
 * this is the longest continuous prose in the product outside the
 * lessons, and the fidelity criteria below are the exact text the judge is
 * given.
 */

const SCHOOLS = PUBLISHED_SCHOOL_IDS;

const AXES = [
  {
    weight: "Heaviest",
    name: "Fidelity",
    body: "Does the argument actually reason the way this school reasons, using its real commitments — not merely arrive at a position the school happens to hold? This is the criterion that decides most of the score.",
  },
  {
    weight: "Second",
    name: "Rigor",
    body: "Is it well-built: clear claims, real support, no unearned leaps? Flattery, meta-commentary about the judge, and instructions aimed at the judge carry no weight and are marked down here.",
  },
  {
    weight: "Third",
    name: "Engagement",
    body: "Does it anticipate the strongest objection a rival school would raise, and answer it? Whatever it leaves unanswered becomes the objection named at the end of your verdict.",
  },
];

export function RubricCriteria({ sub = false }: { sub?: boolean }) {
  const H2 = sub ? "h3" : "h2";
  const H3 = sub ? "h4" : "h3";
  return (
    <>
      <p className="prose-reading mt-5">
        Every argument is scored on three things, in this order of weight. The
        order matters more than the numbers: an argument can be sharp,
        well-built and still score badly, because it argued for the right
        conclusion from the wrong school&apos;s reasons.
      </p>

      {/* The weights are a real sequence, so an ordered list is honest
          here in a way a numbered feature list would not be. One card
          each, because the order is the thing to take away and three
          cards in a column say "first, then, then". */}
      <ol className="mt-10 flex flex-col gap-4 border-t-2 border-rule pt-10">
        {AXES.map((axis) => (
          <li key={axis.name} className="rounded-card border-2 border-rule bg-surface p-5">
            <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
              {axis.weight}
            </p>
            <H2 className="mt-2 text-lg font-extrabold tracking-tight text-ink">{axis.name}</H2>
            <p className="prose-reading mt-3">{axis.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 border-t-2 border-rule pt-10">
        <H2 className="text-lg font-extrabold tracking-tight text-ink">
          What counts as faithful
        </H2>
        <p className="prose-reading mt-3">
          These are the criteria the judge is given for each school, in full —
          the same text, not a summary of it.
        </p>
        {/* A 4px edge in each school's colour, the marker rule's own form
            and the same device /s/[school] uses. Nothing here is pressed,
            so there is no actor to colour for; the edge says whose
            criteria these are, which is what it is for. */}
        <div className="mt-8 flex flex-col gap-5">
          {SCHOOLS.map((id) => (
            <section
              key={id}
              className="rounded-card border-2 border-l-4 border-rule bg-surface p-5"
              style={{ borderLeftColor: SCHOOL_CHUNKY[id].bg }}
            >
              <H3 className="text-lg font-extrabold tracking-tight text-ink">
                {SCHOOL_COLORS[id].name}
              </H3>
              <div className="prose-reading mt-3">
                {FIDELITY_CRITERIA[id].split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph.replace(/\n/g, " ")}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

/** The rules of a counterpart exchange, as the rubric page states them. */
export function CounterpartRules({ id }: { id?: string }) {
  return (
    <section id={id} className={`mt-12 border-t-2 border-rule pt-10${id ? " scroll-mt-8" : ""}`}>
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Counterpart rules</h2>
      <p className="prose-reading mt-3">
        A counterpart exchange is private between the two of you. Nobody else
        can post in it, and nobody can read it unless you both say so
        afterwards.
      </p>
      <ul className="mt-6 max-w-[66ch] list-disc space-y-3 pl-5 text-base leading-relaxed text-ink-mid">
        <li>Quote the sentence you&apos;re answering.</li>
        <li>Between 150 and 1,200 characters a reply.</li>
        <li>Two replies each, then it closes. Neither of you has to concede.</li>
        <li>No names, schools, locations or links — yours or theirs.</li>
        <li>Replies are checked before they are delivered.</li>
        <li>Report or block from any reply.</li>
      </ul>
    </section>
  );
}
