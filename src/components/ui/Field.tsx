import type { ReactNode } from "react";

// Shared chrome for Input, Textarea and Select: label, optional hint,
// optional error. The label is always a real <label>, never a placeholder —
// a placeholder that doubles as a label disappears the moment someone
// starts typing, which is exactly when they need it.
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && (
        // role="alert" so the message is announced when it appears, not
        // only when focus next lands on the field.
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

// Every control shares one border, one radius, one surface. Only the error
// state changes the border, and it is always paired with a message — colour
// never carries the fact on its own.
export function controlClasses(error?: string): string {
  return [
    "w-full rounded-control border bg-surface px-3 py-2.5 text-base text-ink",
    "placeholder:text-ink-soft",
    "disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-soft",
    error ? "border-error" : "border-rule hover:border-rule-strong",
  ].join(" ");
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
