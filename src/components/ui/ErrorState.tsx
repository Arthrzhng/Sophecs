import type { ReactNode } from "react";

/**
 * Something went wrong, and what to do about it.
 *
 * Two things, always: what happened, and the way out. No apology, no
 * exclamation mark, no "oops". The detail line is for a message from the
 * server worth showing; it is in mono because it is a value, and optional
 * because most of the time there isn't one.
 *
 * A card with an error-coloured left edge, not a hairline. It keeps
 * `role="alert"` and that edge, which is what separates it from the
 * notice cards the restyle introduced: a paused judge is the state of the
 * product and gets a plain card, a failure is a fault and gets this.
 */
export function ErrorState({
  title,
  body,
  detail,
  action,
}: {
  title: string;
  body: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-card border-2 border-l-4 border-rule bg-surface p-5"
      style={{ borderLeftColor: "var(--color-error)" }}
    >
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">{body}</p>
      {detail && <p className="mt-2 font-mono text-xs text-ink-soft">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
