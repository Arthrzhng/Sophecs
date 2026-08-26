"use client";

// STUB: image export of the result card lands later; the button ships now in
// its disabled state so the flow reads complete.
export function ShareButton() {
  return (
    <span className="relative inline-block group">
      <button
        type="button"
        disabled
        className="border border-rule rounded-btn px-5 py-2.5 text-sm font-medium text-ink-soft cursor-not-allowed bg-surface"
      >
        Share card
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap rounded-btn bg-ink text-surface font-mono text-xs px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        coming soon
      </span>
    </span>
  );
}
