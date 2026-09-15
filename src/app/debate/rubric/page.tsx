import Link from "next/link";
import { RubricViewTracker } from "@/components/debate/RubricViewTracker";
import { FIDELITY_CRITERIA } from "@/lib/judge/rubric";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export const metadata = {
  title: "How this was judged · Sophecs",
  description:
    "The criteria the judge scores on: fidelity to the school first, rigor second, engagement third.",
};

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// Static. A literal segment beats the sibling [slug] route, so /debate/rubric
// resolves here rather than to a topic lookup. Published because a score
// nobody can interrogate is a score nobody should trust — the brief's
// "fidelity-first, breakdown visible" applies to the criteria too.
export default function RubricPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <RubricViewTracker />
        <p className="eyebrow text-ink-soft mb-4">The rubric</p>
        <h1 className="font-serif text-2xl font-medium">How this was judged</h1>
        <p className="mt-4 text-ink-mid leading-relaxed max-w-[54ch]">
          Every argument is scored on three things, in this order of weight.
          The order matters more than the numbers: an argument can be sharp,
          well-built and still score badly, because it argued for the right
          conclusion from the wrong school&apos;s reasons.
        </p>

        <ol className="mt-10 space-y-8 border-t border-rule pt-8">
          <li>
            <p className="eyebrow-sm text-ink-soft mb-2">First · heaviest</p>
            <h2 className="font-serif text-lg font-medium">Fidelity</h2>
            <p className="mt-2 text-ink-mid leading-relaxed max-w-[54ch]">
              Does the argument actually reason the way this school reasons,
              using its real commitments — not merely arrive at a position the
              school happens to hold? This is the criterion that decides most
              of the score.
            </p>
          </li>
          <li>
            <p className="eyebrow-sm text-ink-soft mb-2">Second</p>
            <h2 className="font-serif text-lg font-medium">Rigor</h2>
            <p className="mt-2 text-ink-mid leading-relaxed max-w-[54ch]">
              Is it well-built: clear claims, real support, no unearned leaps?
              Flattery, meta-commentary about the judge, and instructions
              aimed at the judge carry no weight and are marked down here.
            </p>
          </li>
          <li>
            <p className="eyebrow-sm text-ink-soft mb-2">Third</p>
            <h2 className="font-serif text-lg font-medium">Engagement</h2>
            <p className="mt-2 text-ink-mid leading-relaxed max-w-[54ch]">
              Does it anticipate the strongest objection a rival school would
              raise, and answer it? Whatever it leaves unanswered becomes the
              objection named at the end of your verdict.
            </p>
          </li>
        </ol>

        <div className="mt-14 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-4">What counts as faithful</p>
          <p className="text-ink-mid leading-relaxed max-w-[54ch]">
            These are the criteria the judge is given for each school, in full.
          </p>
          <div className="mt-8 space-y-10">
            {SCHOOLS.map((id) => (
              <section key={id}>
                <h3 className="font-serif text-lg font-medium">{SCHOOL_COLORS[id].name}</h3>
                <div className="mt-3 space-y-4">
                  {FIDELITY_CRITERIA[id]
                    .split("\n\n")
                    .map((paragraph, i) => (
                      <p key={i} className="font-serif text-base leading-relaxed max-w-[54ch]">
                        {paragraph.replace(/\n/g, " ")}
                      </p>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-14 border-t border-rule pt-8">
          <Link
            href="/debate"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Back to the motions
          </Link>
        </div>
      </div>
    </main>
  );
}
