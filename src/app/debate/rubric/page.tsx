import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { RubricViewTracker } from "@/components/debate/RubricViewTracker";
import { CounterpartRules, RubricCriteria } from "@/components/how-it-works/Rubric";

export const metadata = {
  title: "How this was judged · Sophecs",
  description:
    "The criteria the judge scores on: fidelity to the school first, rigor second, engagement third.",
};

// Static. A literal segment beats the sibling [slug] route, so /debate/rubric
// resolves here rather than to a topic lookup. Its text is in
// src/components/how-it-works/Rubric.tsx, shared with /how-it-works, which
// a SIX_SCHOOLS build redirects this page to.
export default function RubricPage() {
  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="read" rhythm="path">
        <RubricViewTracker />
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          The rubric
        </p>
        <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
          How this was judged
        </h1>
        <RubricCriteria />

        <CounterpartRules />

        <div className="mt-12 border-t-2 border-rule pt-10" data-print="hide">
          <Link
            href="/debate"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
          >
            Back to the motions
          </Link>
        </div>
    </Page>
  );
}
