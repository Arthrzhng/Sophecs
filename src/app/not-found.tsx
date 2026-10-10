import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";

export const metadata = { title: "Not found · Sophecs" };

// Server component, zero client JS. Two ways out and nothing else — no
// search box, no sitemap dump.
//
// Ink, not a school: whoever lands here may never have taken the quiz,
// and this is a page that sends them to it. See docs/decisions.md.
export default function NotFound() {
  return (
    <Page width="read" rhythm="path">
      <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink">
        Nothing here.
      </h1>
      <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-ink-mid">
        The page you followed doesn&apos;t exist, or it moved.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <ChunkyLink href="/quiz" tone="ink">
          Take the quiz
        </ChunkyLink>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Home
        </Link>
      </div>
    </Page>
  );
}
