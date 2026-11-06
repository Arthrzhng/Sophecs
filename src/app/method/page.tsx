import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { JudgeMethod, SampleAccounts } from "@/components/how-it-works/JudgeMethod";

export const metadata = {
  title: "How the judge works · Sophecs",
  description:
    "What the judge scores, what that score does and does not mean, and the limitations it is read under.",
};

// Static, and deliberately plain. /debate/rubric publishes the criteria the
// judge is given; this page says what the resulting number is worth, which
// is a different question and the one a reader outside the product asks
// first. Its text is in src/components/how-it-works/JudgeMethod.tsx, shared
// with /how-it-works, which a SIX_SCHOOLS build redirects this page to.
export default function MethodPage() {
  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="read" rhythm="path">
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          The method
        </p>
        <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
          How the judge works
        </h1>

        <JudgeMethod />

        <SampleAccounts />

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
    </Page>
  );
}
