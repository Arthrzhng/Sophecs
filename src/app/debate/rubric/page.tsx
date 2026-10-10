import Link from "next/link";
import { RubricViewTracker } from "@/components/debate/RubricViewTracker";
import { SCHOOL_CHUNKY } from "@/components/daily-path/chunky";
import { FIDELITY_CRITERIA } from "@/lib/judge/rubric";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export const metadata = {
  title: "How this was judged · Sophecs",
  description:
    "The criteria the judge scores on: fidelity to the school first, rigor second, engagement third.",
};

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

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

// Static. A literal segment beats the sibling [slug] route, so /debate/rubric
// resolves here rather than to a topic lookup. Published because a score
// nobody can interrogate is a score nobody should trust.
//
// Read as a document rather than laid out as a feature page: this is the
// longest continuous prose in the product outside the lessons, and the
// fidelity criteria below are the exact text the judge is given.
export default function RubricPage() {
  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; see the note on /me.
  return (
    <main className="flex-1" data-daily-path>
      <div className="mx-auto max-w-read px-6 py-10">
        <RubricViewTracker />
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          The rubric
        </p>
        <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
          How this was judged
        </h1>
        <p className="prose-reading mt-5">
          Every argument is scored on three things, in this order of weight. The
          order matters more than the numbers: an argument can be sharp,
          well-built and still score badly, because it argued for the right
          conclusion from the wrong school&apos;s reasons.
        </p>

        {/* The weights are a real sequence, so the ordered list is honest
            here in a way a numbered feature list would not be. */}
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
              <h2 className="mt-2 text-lg font-extrabold tracking-tight text-ink">{axis.name}</h2>
              <p className="prose-reading mt-3">{axis.body}</p>
            </li>
          ))}
        </ol>

        <section className="mt-12 border-t-2 border-rule pt-10">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            What counts as faithful
          </h2>
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
                <h3 className="text-lg font-extrabold tracking-tight text-ink">
                  {SCHOOL_COLORS[id].name}
                </h3>
                <div className="prose-reading mt-3">
                  {FIDELITY_CRITERIA[id].split("\n\n").map((paragraph, i) => (
                    <p key={i}>{paragraph.replace(/\n/g, " ")}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t-2 border-rule pt-10">
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

        <div className="mt-12 border-t-2 border-rule pt-10" data-print="hide">
          <Link
            href="/debate"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
          >
            Back to the motions
          </Link>
        </div>
      </div>
    </main>
  );
}
