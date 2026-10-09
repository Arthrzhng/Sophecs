import Link from "next/link";

/**
 * What the arena says while the judge is off.
 *
 * A card, not the shared ErrorState: judging being paused is the state of
 * the product today, not a fault in this page, and an alert claiming
 * otherwise would make the one real failure on this screen harder to
 * find. Today's path says the same thing in the same shape.
 *
 * Its own component so the styleguide can show it; the route cannot be
 * rendered without a Supabase session.
 */
export function JudgingPausedNotice() {
  return (
    <section className="rounded-card border-2 border-rule bg-surface p-5">
      <h2 className="text-base font-extrabold text-ink">Judging is paused.</h2>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-mid">
        Judging is paused while we check the quality of the verdicts. You can
        still read the motions and write an argument, and your draft stays in
        this browser, but nothing reaches the judge today and no verdict comes
        back.
      </p>
      <p className="mt-3 flex flex-wrap gap-5">
        <Link
          href="/method"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          How the judge works
        </Link>
        <Link
          href="/lessons"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Read the lessons instead
        </Link>
      </p>
    </section>
  );
}
