import type { ReactNode } from "react";

// Two things, always: what happened, and what to do about it. No apology,
// no exclamation mark, no "oops". The detail line is for a message from the
// server that is worth showing — it is rendered in mono because it is a
// value, and it is optional because most of the time there isn't one.
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
    <div role="alert" className="border-l-2 border-error pl-4">
      <p className="font-serif text-base text-ink">{title}</p>
      <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-ink-mid">{body}</p>
      {detail && <p className="mt-2 font-mono text-xs text-ink-soft">{detail}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
