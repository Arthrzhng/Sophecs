import { SAMPLE_EXPLANATION, SAMPLE_TAG } from "@/lib/sample";

/**
 * The small "AI" tag beside a sample account's work (Arthur, 2026-11-08:
 * "one small, quiet 'AI' tag beside a sample's name where it appears").
 * It opens to the explanation /how-it-works gives, and on a verdict scored
 * from a template to the line saying the judge did not read it. Nothing
 * more: no banner, no modal.
 *
 * A <details> rather than a tooltip, so it works without JavaScript, by
 * keyboard and by touch, and opens on a tap rather than a hover. It is flow
 * content, so it sits in a flex row beside the thing it tags, never inside
 * a <p>. Opened, at any width, it takes a line of its own.
 */
export function SampleLabel({ note }: { note?: string }) {
  return (
    <details className="group open:basis-full">
      <summary className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden">
        <span className="rounded-control border border-rule px-1.5 text-xs font-semibold text-ink-mid group-open:text-ink">
          {SAMPLE_TAG}
        </span>
      </summary>
      <p className="mb-2 max-w-[44ch] text-sm leading-relaxed text-ink-mid">
        {SAMPLE_EXPLANATION}
        {note && ` ${note}`}
      </p>
    </details>
  );
}
