import Link from "next/link";
import { LandingQuestion } from "@/components/quiz/LandingQuestion";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { getSchool } from "@/lib/schools";
import { getAllTopicFiles } from "@/lib/topics";
import { SCHOOL_IDS } from "@/lib/types";

// Static, and it stays static: every string here comes from a content file
// read at build time, the question is a client component (which does not
// opt a page out of prerendering), and nothing on this route reads a
// cookie or a session.
//
// The hero and the three how-it-works cards are mockup 01. The question
// inside the hero is not: the landing has opened on question one since the
// rebuild, which makes it the first screen of the quiz rather than a page
// describing one, and replacing it with a "Take the quiz" button would cost
// a tap on the only path that matters and move quiz_started onto /quiz.
// See src/components/quiz/LandingQuestion.tsx.
export default function LandingPage() {
  // The lowest-sorted active motion, read from the content files rather
  // than the database so the landing never depends on Supabase being
  // reachable and stays statically rendered.
  const motion = getAllTopicFiles()
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort)[0];

  return (
    <main className="flex-1" data-daily-path>
      <div className="mx-auto max-w-ui px-6 pt-6 pb-20 sm:pt-8">
        {/*
          Below `sm` the subtitle sits under the answer rows, so all three
          answers clear the fold on a 375x667 phone. Source order is left
          alone: a screen reader still hears the headline, then what the
          product is, then the question, which is the order that reads.
        */}
        <div className="flex flex-col">
          <h1 className="order-1 max-w-[26ch] text-lg font-extrabold leading-tight tracking-tight text-ink sm:text-xl">
            Find your school of ethics. Then defend it, a little every day.
          </h1>
          <p className="order-3 mt-6 max-w-[52ch] text-base leading-relaxed text-ink-mid sm:order-2 sm:mt-4">
            A short quiz places you with the Stoics, the Utilitarians or the Virtue
            Ethicists. Then a few minutes a day: read the case, argue the week&apos;s
            question about AI, and get judged on how true you stay to your school.
          </p>

          {/* Question one, live. The triangle beside it is the mockup's hero
              illustration doing a real job: at zero answers the marker sits
              at the centre, which is where you start. */}
          <div className="order-2 mt-4 sm:order-3 sm:mt-8">
            <LandingQuestion />
          </div>

          <p className="order-4 mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            {/* Not "nothing is saved unless you share it": the result
                screen writes the answers and the school to quiz_results
                against the anon_id cookie, and PostHog records
                quiz_completed. What is true is that neither carries a
                name. */}
            <span>About 80 seconds. No sign-up, and no name attached to your answers.</span>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4"
            >
              I already have a school
            </Link>
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(17rem,100%),1fr))] gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <div
                className="chunky flex h-full flex-col gap-2 rounded-panel border-2 border-rule-strong bg-surface p-5"
                style={{ ["--sh" as string]: "var(--color-rule-strong)" }}
              >
                {/* Badge 1 is ink, not the mockup's Stoic green: a green
                    square beside "Find your school" answers the question
                    the quiz is there to ask, and the only green in this
                    product means Stoicism. 2 and 3 keep the mockup's
                    step and progress colours, which belong to no school. */}
                <span
                  aria-hidden="true"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-chunky text-base font-extrabold text-white"
                  style={{ background: step.badge }}
                >
                  {i + 1}
                </span>
                <h2 className="mt-1 text-base font-extrabold text-ink">{step.title}</h2>
                <p className="text-sm leading-relaxed text-ink-mid">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-12 border-t-2 border-rule pt-10">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            The three schools
          </h2>
          {/* Real quotation with real citation, which is the only thing on
              this page that shows what the schools actually say. */}
          <ul className="mt-6 grid gap-6 sm:grid-cols-3">
            {SCHOOL_IDS.map((id) => {
              const school = getSchool(id);
              return (
                <li key={id} className="rounded-card border-2 border-rule bg-surface p-5">
                  <h3 className="text-base font-extrabold text-ink">
                    <Link
                      href={`/s/${id}`}
                      className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                    >
                      {school.name}
                    </Link>
                  </h3>
                  <p className="mt-3 font-serif text-base leading-relaxed text-ink-mid">
                    &ldquo;{school.one_line}&rdquo;
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{school.one_line_attribution}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {motion && (
          <section className="mt-12 border-t-2 border-rule pt-10">
            <h2 className="text-lg font-extrabold tracking-tight text-ink">
              A motion you could argue
            </h2>
            <p className="mt-4 max-w-[60ch] font-serif text-md leading-relaxed text-ink">
              {motion.motion}
            </p>
            <p className="mt-4">
              <Link
                href={`/debate/${motion.slug}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
              >
                Read the motion
              </Link>
            </p>
          </section>
        )}

        <section className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-panel border-2 border-rule bg-surface p-6">
          <div className="min-w-0 max-w-[40ch]">
            <h2 className="text-base font-extrabold text-ink">
              Every lesson is built from primary sources.
            </h2>
            {/* The mockup's second sentence here is a bracketed placeholder
                for a schools-pilot partner that does not exist yet, so it
                is absent rather than invented. */}
            <p className="mt-2 text-sm leading-relaxed text-ink-mid">
              Free to read, whichever school you land in.
            </p>
          </div>
          <ChunkyLink href="/lessons" tone="paper">
            Browse lessons
          </ChunkyLink>
        </section>
      </div>
    </main>
  );
}

// Mockup 01's three cards. Card 3 said "four axes"; docs/daily-path-copy.md
// §6 settles the count at three, and content/prompts/judge.v2.md is what
// actually decides.
const STEPS = [
  {
    title: "Find your school",
    body: "A short quiz. Every answer moves you across the triangle.",
    badge: "var(--color-ink)",
  },
  {
    title: "Walk the weekly path",
    body: "Read the case, check your reading, argue, face an objection, revise once.",
    badge: "var(--color-step-done)",
  },
  {
    title: "Get the verdict",
    body: "Scored on three axes, including fidelity to your school. Keep your streak alive.",
    badge: "var(--color-correct)",
  },
];
