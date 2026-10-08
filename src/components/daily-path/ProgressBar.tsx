/**
 * Question progress on the reading check.
 *
 * A real <progress> rather than two divs: it carries its own role, value and
 * max to assistive technology, so the visible label and the announced one
 * cannot drift. The bar is restyled through the vendor pseudo-elements,
 * which is the only way to colour it without giving up the semantics.
 */
export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-semibold text-ink-mid">{label}</span>
        <span className="font-mono tabular text-sm text-ink-mid">
          {value}/{max}
        </span>
      </div>
      <progress
        value={value}
        max={max}
        className="dp-progress mt-2 block h-3 w-full appearance-none overflow-hidden rounded-chunky"
      >
        {value} of {max}
      </progress>
    </div>
  );
}
