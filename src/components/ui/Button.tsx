import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "quiet";

// Three variants, one shape. `quiet` is a button that behaves like a button
// but reads like a link — used where an action sits inside prose and giving
// it a border would over-weight it.
//
// Every variant is min-h-11 (44px), comfortably past WCAG 2.5.8's 24px.
// Focus comes from the global :focus-visible rule, not from a per-variant
// ring, so a new variant cannot forget it.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper border border-ink hover:bg-ink-mid hover:border-ink-mid disabled:bg-ink-soft disabled:border-ink-soft",
  secondary:
    "bg-surface text-ink border border-rule hover:border-rule-strong disabled:text-ink-soft disabled:border-rule",
  quiet:
    "bg-transparent text-ink-mid border border-transparent underline underline-offset-4 hover:text-ink disabled:text-ink-soft disabled:no-underline",
};

const SHAPE =
  "inline-flex min-h-11 items-center justify-center rounded-control px-5 text-sm font-medium";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Replaces the label while `loading`. Defaults to the label itself. */
  loadingLabel?: string;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      // A loading button stays focusable and keeps its accessible name; it
      // is `aria-busy` rather than removed from the tree, so a screen reader
      // that was on it does not lose its place.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`${SHAPE} disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
}

// A link that carries a button's weight. Navigation is a link — making it a
// button and calling router.push loses the middle click, the open-in-new-tab
// and the status-bar URL — so this shares the shape and the variants rather
// than restating them, which is how four hand-written copies of the primary
// button's class string got into the arena in the first place.
export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={`${SHAPE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
