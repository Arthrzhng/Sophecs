import Link from "next/link";
import type { ComponentProps } from "react";

// The only link style in the product. Underlined always, not on hover —
// an underline that appears on hover is invisible to anyone scanning, and
// on a touch screen there is no hover at all.
//
// No arrow glyph is ever appended. If a link needs to say where it goes,
// it says so in words.
export function TextLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink ${className}`}
      {...props}
    />
  );
}
