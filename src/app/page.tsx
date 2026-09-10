import Link from "next/link";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-6 pt-24 pb-20">
        <p className="eyebrow text-ink-soft mb-6">Nine questions, no login</p>
        <h1 className="font-serif text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.15] tracking-tight max-w-[18ch]">
          When an algorithm decides for you, which philosopher would back you up?
        </h1>
        <p className="mt-6 text-lg text-ink-mid leading-relaxed max-w-[52ch]">
          A wallet with cash on the street. An AI that could finish your
          assignment undetected. A self-driving car that has to choose.
          Nine real scenarios, three schools of ethics, no answer that&apos;s
          obviously correct.
        </p>
        <div className="mt-10">
          <Link
            href="/quiz"
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85 transition-opacity"
          >
            Take the quiz
          </Link>
        </div>
        <p className="mt-6 font-mono text-xs text-ink-soft">
          About 80 seconds. Nothing saved unless you share it.
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-20">
        <div className="border-t border-rule pt-10">
          <p className="eyebrow text-ink-soft mb-6">The three schools</p>
          <ul className="grid gap-8 sm:grid-cols-3">
            {SCHOOLS.map((id) => {
              const school = getSchool(id);
              return (
                <li key={id}>
                  <Link href={`/s/${id}`} className="block group">
                    <h2 className="font-serif text-lg font-medium group-hover:underline underline-offset-4">
                      {school.name}
                    </h2>
                    <p className="mt-2 text-sm text-ink-mid leading-relaxed">
                      {school.one_line}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-24">
        <div className="border-t border-rule pt-10">
          <p className="eyebrow text-ink-soft mb-3">Then argue it</p>
          <p className="text-ink-mid leading-relaxed max-w-[54ch]">
            The quiz gives you a starting position. The rest of Sophecs is
            about defending it: take a motion, write a case, and get judged on
            how faithfully you argue from your school — not on whether anyone
            agrees with you.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <Link
              href="/debate"
              className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
            >
              See the motions
            </Link>
            <Link
              href="/lessons"
              className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
            >
              Read the lessons
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
