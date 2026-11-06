import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { JudgeMethod, SampleAccounts } from "@/components/how-it-works/JudgeMethod";
import { CounterpartRules, RubricCriteria } from "@/components/how-it-works/Rubric";
import { RubricSectionViewTracker } from "@/components/how-it-works/RubricSectionViewTracker";

// A build without the flag never reaches this page: next.config.ts
// rewrites its address to one no route answers, so the reader gets the
// site's own not-found page, as before the page existed. The metadata is
// generated, and refuses as the page does, so that even reached some
// other way it says nothing of the page.
export async function generateMetadata(): Promise<Metadata> {
  if (process.env.SIX_SCHOOLS !== "1") notFound();
  return {
    title: "How it works · Sophecs",
    description:
      'What the judge scores, the criteria it is given, and what a score does and does not mean.',
  };
}

// The judge's method (/method) and the rubric (/debate/rubric) as one page,
// on a SIX_SCHOOLS build (Arthur, 2026-11-06; docs/daily-path-copy.md,
// section 13). Their text is unchanged and shared with them; only the
// heading, the contents line and the anchors are new. A SIX_SCHOOLS build
// redirects both old addresses here (next.config.ts), /method keeping its
// anchor, so /method#samples still lands on the sample accounts.
//
// A build without the flag, production included, has no such page: the
// two old pages are what it serves.
const SECTIONS = [
  { id: "judge", label: "How the judge works" },
  { id: "rubric", label: "How this was judged" },
  { id: "counterpart", label: "Counterpart rules" },
  { id: "samples", label: "Sample accounts" },
] as const;

export default function HowItWorksPage() {
  if (process.env.SIX_SCHOOLS !== "1") notFound();
  return (
    <Page width="read" rhythm="path">
      <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink">How it works</h1>

      <nav aria-label="On this page" className="mt-5">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="judge" className="mt-10 scroll-mt-8 border-t-2 border-rule pt-10">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">How the judge works</h2>
        <JudgeMethod sub />
      </section>

      <section id="rubric" className="mt-12 scroll-mt-8 border-t-2 border-rule pt-10">
        <RubricSectionViewTracker id="rubric" />
        <h2 className="text-lg font-extrabold tracking-tight text-ink">How this was judged</h2>
        <RubricCriteria sub />
      </section>

      <CounterpartRules id="counterpart" />

      <SampleAccounts />

      <div className="mt-12 border-t-2 border-rule pt-10">
        {/* /method's closing sentence, kept (Arthur, 2026-11-06: "That
            transparency is part of the site's credibility"); its link is to
            the rubric's section here. */}
        <p className="max-w-[66ch] text-base leading-relaxed text-ink-mid">
          The criteria the judge is given are published in full, including the
          fidelity criteria for each school.{" "}
          <a href="#rubric" className="font-semibold text-ink underline underline-offset-4">
            Read the rubric
          </a>
          .
        </p>
        <p className="mt-4 max-w-[66ch] text-base leading-relaxed text-ink-mid">
          Questions or corrections: arthur.rzhang@gmail.com
        </p>
        <Link
          href="/debate"
          data-print="hide"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Back to the motions
        </Link>
      </div>
    </Page>
  );
}
