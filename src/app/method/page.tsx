import Link from "next/link";

export const metadata = {
  title: "How the judge works · Sophecs",
  description:
    "What the judge scores, what that score does and does not mean, and the limitations it is read under.",
};

// Static, and deliberately plain. /debate/rubric publishes the criteria the
// judge is given; this page says what the resulting number is worth, which
// is a different question and the one a reader outside the product asks
// first. Every claim here is taken from content/prompts/judge.v2.md or from
// the code that calls it. There is no claim of validity or accuracy, because
// none has been established.
//
// The scored criteria are three, not four: judge.v2.md lists Fidelity,
// Rigor and Engagement under "Score in this order of priority", and the
// response schema adds one composite `score` on top of them.
export default function MethodPage() {
  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; see the note on /me.
  return (
    <main className="flex-1" data-daily-path>
      <div className="mx-auto max-w-read px-6 py-10">
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          The method
        </p>
        <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
          How the judge works
        </h1>

        <div className="prose-reading mt-6">
          <p>
            Sophecs asks you to argue a motion from the school of ethics the quiz
            placed you in. An AI model reads your argument together with the
            motion and the written criteria for your school. It sees nothing else
            about you.
          </p>

          <p>
            It scores three things, in this order of weight.{" "}
            <strong className="font-medium">Fidelity</strong> asks whether the
            argument reasons the way that school reasons, using its actual
            commitments, rather than merely arriving at a position the school
            happens to hold. <strong className="font-medium">Rigor</strong> asks
            whether the argument is well built: clear claims, real support, no
            unearned leaps. <strong className="font-medium">Engagement</strong>{" "}
            asks whether it anticipates the strongest objection a rival school
            would raise, and answers it. Those three are reported alongside a
            single combined score out of 100.
          </p>

          <p>
            What that measures is how faithfully a piece of writing applies one
            school of thought. It is not a measure of wisdom, of character, or of
            how good a person you are. A high score means you argued like a
            Stoic, not that you are wise. Nothing on this site assesses you as a
            person.
          </p>
        </div>

        {/* A card, not another section of prose. These are the four
            sentences a reader is most likely to skim past and the ones
            the page exists to make unskippable. */}
        <section className="mt-12 rounded-card border-2 border-rule bg-surface p-6">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Known limitations
          </h2>
          <ul className="mt-4 max-w-[66ch] list-disc space-y-3 pl-5 text-base leading-relaxed text-ink-mid">
            <li>
              A language model can reward writing that is fluent over reasoning
              that is sound.
            </li>
            <li>
              It can be wrong about what a school is committed to, and it can be
              wrong about your argument.
            </li>
            <li>
              Verdict quality is still being checked against real arguments. That
              is why judging is paused rather than running.
            </li>
            <li>
              Sophecs is early stage. There is no evidence yet that it improves
              anyone&apos;s reasoning, and no such claim is made.
            </li>
          </ul>
        </section>

        <div className="mt-12 border-t-2 border-rule pt-10">
          <p className="max-w-[66ch] text-base leading-relaxed text-ink-mid">
            The criteria the judge is given are published in full, including the
            fidelity criteria for each school.{" "}
            <Link
              href="/debate/rubric"
              className="font-semibold text-ink underline underline-offset-4"
            >
              Read the rubric
            </Link>
            .
          </p>
          <p className="mt-4 max-w-[66ch] text-base leading-relaxed text-ink-mid">
            Questions or corrections: arthur.rzhang@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
