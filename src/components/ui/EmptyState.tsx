import type { ReactNode } from "react";

// An empty state says what to do first, not that something is empty.
// "No motions yet" is a fact the user can already see; the useful half is
// the action underneath it.
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
    <div className="border-t border-rule pt-6">
      <p className="font-serif text-base text-ink">{title}</p>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
