import type { ReactNode } from "react";

/**
 * Nothing here yet, and what to do first.
 *
 * An empty state says what to do first, not that something is empty.
 * "No motions yet" is a fact the reader can already see; the useful half
 * is the action underneath it.
 *
 * A plain card, where ErrorState beside it has an error-coloured edge and
 * an alert role. Emptiness is not a fault and must not announce itself as
 * one: a reader with an empty profile has done nothing wrong.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border-2 border-rule bg-surface p-5">
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
