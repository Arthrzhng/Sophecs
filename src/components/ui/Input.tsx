import type { InputHTMLAttributes } from "react";
import { Field, controlClasses, describedBy } from "./Field";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ id, label, hint, error, className = "", ...props }: InputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClasses(error)} ${className}`}
        {...props}
      />
    </Field>
  );
}
