import type { SelectHTMLAttributes } from "react";
import { Field, controlClasses, describedBy } from "./Field";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

// A native <select>. On a phone this opens the OS picker, which is faster,
// accessible for free, and impossible to get wrong — a custom listbox would
// be a dependency and a keyboard-interaction surface for no gain.
export function Select({
  id,
  label,
  hint,
  error,
  options,
  className = "",
  ...props
}: SelectProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {/*
        The chevron is a real <svg> using currentColor, not a data-URI
        background. A data URI is a separate document, so `currentColor`
        does not resolve inside one and the colour has to be written as a
        literal hex — which would be the only hardcoded colour in the
        primitives. `pointer-events-none` keeps clicks going to the select.
      */}
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${controlClasses(error)} appearance-none pr-10 ${className}`}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          width="12"
          height="8"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-mid"
        >
          <path
            d="M1 1.5 6 6.5 11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Field>
  );
}
