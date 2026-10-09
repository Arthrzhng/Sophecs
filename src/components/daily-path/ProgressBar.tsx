/**
 * Question progress on the reading check.
 *
 * A real <progress> rather than two divs: it carries its own role, value and
 * max to assistive technology, so the visible label and the announced one
 * cannot drift. The bar is restyled through the vendor pseudo-elements,
 * which is the only way to colour it without giving up the semantics.
 *
 * `bare` drops the label row and keeps the track alone, which is what the
 * lesson player's top bar shows: the count in words next to an X button
 * reads as chrome, and the mockups put nothing there but the track. The
 * label moves onto the element as its accessible name rather than being
 * dropped, so "Question 1 of 2" still reaches a screen reader — it is the
 * only thing that tells a reader who cannot see the track how far along
 * they are.
 */
export function ProgressBar({
  value,
  max,
  label,
  bare = false,
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {!bare && (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold text-ink-mid">{label}</span>
          <span className="font-mono tabular text-sm text-ink-mid">
            {value}/{max}
          </span>
        </div>
      )}
      <progress
        value={value}
        max={max}
        // Named only in bare mode: with the label row visible the name would
        // be announced twice, once as the heading and once as the bar's own.
        aria-label={bare ? label : undefined}
        className={`dp-progress block h-3 w-full appearance-none overflow-hidden rounded-chunky ${
          bare ? "" : "mt-2"
        }`}
      >
        {value} of {max}
      </progress>
    </div>
  );
}
