import { SAMPLE_EXPLANATION, SAMPLE_LABEL } from "@/lib/sample";

/**
 * The small "Sample" label on anything a sample account made. It opens to
 * say what a sample account is, and nothing more: no banner, no modal.
 *
 * A <details> rather than a tooltip, so it works without JavaScript, by
 * keyboard and by touch, and the explanation is in the page for a screen
 * reader rather than hidden behind a hover.
 */
export function SampleLabel({ className = "" }: { className?: string }) {
  return (
    <details className={`group ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
        <span className="rounded-control border-2 border-rule-strong bg-surface px-2 py-0.5 text-xs font-extrabold tracking-widest text-ink-mid uppercase group-open:text-ink">
          {SAMPLE_LABEL}
        </span>
      </summary>
      <p className="mt-1 max-w-[44ch] text-sm leading-relaxed text-ink-mid">{SAMPLE_EXPLANATION}</p>
    </details>
  );
}
