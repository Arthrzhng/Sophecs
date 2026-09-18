import Link from "next/link";
import { Page } from "@/components/layout/Page";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "Not found · Sophecs" };

// Server component, zero client JS. Two ways out and nothing else — no
// search box, no sitemap dump.
export default function NotFound() {
  return (
    <Page width="read">
        <h1 className="font-serif text-xl font-medium leading-tight text-ink">Nothing here.</h1>
        <p className="mt-4 text-ink-mid leading-relaxed max-w-[48ch]">
          The page you followed doesn&apos;t exist, or it moved.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <ButtonLink
            href="/quiz"
          >
            Take the quiz
          </ButtonLink>
          <Link
            href="/"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Home
          </Link>
        </div>
    </Page>
  );
}
