import type { TextareaHTMLAttributes } from "react";
import { Field, controlClasses, describedBy } from "./Field";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Rendered under the field, right-aligned, in mono. A count is a number. */
  count?: string;
  /** Turns the count red without changing the field's own border. */
  countOverLimit?: boolean;
  /** Argument and reply bodies are read as prose, so they are set in serif. */
  serif?: boolean;
}

export function Textarea({
  id,
  label,
  hint,
  error,
  count,
  countOverLimit,
  serif = false,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClasses(error)} resize-y leading-relaxed ${serif ? "font-serif" : ""} ${className}`}
        {...props}
      />
      {count && (
        <p
          className={`mt-2 text-right font-mono text-xs tabular ${countOverLimit ? "text-error" : "text-ink-soft"}`}
        >
          {count}
        </p>
      )}
    </Field>
  );
}
