import type { ReactNode } from "react";

function Tick() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * The right/wrong panel that arrives from the bottom after an answer is
 * checked.
 *
 * Three things carry the result, so none of them is load-bearing alone: the
 * heading words it ("Exactly." / "Not quite."), the glyph differs in shape
 * (tick against cross, not two colours of the same mark), and the colour
 * changes. `role="status"` announces the heading and body together, which
 * is what makes the result reach a screen reader at all.
 *
 * Blue for right rather than green: the only green in this product means
 * Stoicism.
 */
export function FeedbackSheet({
  correct,
  heading,
  body,
  extra,
  action,
}: {
  correct: boolean;
  heading: string;
  body: string;
  /** The "The right answer: ..." line, shown only on a wrong answer. */
  extra?: string;
  action: ReactNode;
}) {
  const tone = correct
    ? {
        bg: "var(--color-correct-tint)",
        line: "var(--color-correct)",
        ink: "var(--color-correct-deep)",
      }
    : {
        bg: "var(--color-wrong-tint)",
        line: "var(--color-wrong)",
        ink: "var(--color-wrong-deep)",
      };

  return (
    <div
      role="status"
      className="sheet sticky bottom-0 left-0 right-0 border-t-4 px-6 py-5"
      style={{ background: tone.bg, borderColor: tone.line }}
    >
      <div className="mx-auto flex max-w-ui flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0" style={{ color: tone.line }}>
            {correct ? <Tick /> : <Cross />}
          </span>
          <div>
            <p className="text-base font-extrabold" style={{ color: tone.ink }}>
              {heading}
            </p>
            <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink">{body}</p>
            {extra && (
              <p className="mt-2 max-w-[60ch] text-sm leading-relaxed" style={{ color: tone.ink }}>
                {extra}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
