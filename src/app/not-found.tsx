import Link from "next/link";

export const metadata = { title: "Not found · Sophecs" };

// Server component, zero client JS. Two ways out and nothing else — no
// search box, no sitemap dump.
export default function NotFound() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-24 pb-24">
        <h1 className="font-serif text-3xl font-medium">Nothing here.</h1>
        <p className="mt-4 text-ink-mid leading-relaxed max-w-[48ch]">
          The page you followed doesn&apos;t exist, or it moved.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Link
            href="/quiz"
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85"
          >
            Take the quiz
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
