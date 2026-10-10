import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { SchoolId } from "@/lib/types";
import { SCHOOL_CHUNKY, shade } from "./chunky";

export type ChunkyTone = "school" | "ink" | "paper" | "correct" | "wrong" | "quiet";

/**
 * The restyle's primary control: a solid bottom edge that the button travels
 * down onto when pressed. The press itself lives in `.chunky` in globals.css
 * so every chunky surface, not only buttons, presses the same way.
 *
 * `school` is the default because the design makes the primary action the
 * reader's own school colour. The school has to be passed in rather than
 * defaulted; a wrong school on a button is worse than no colour.
 *
 * `ink` is the primary for the screens where the reader genuinely has no
 * school: /login is the first, and it is where they go to get one. It is
 * the only tone whose shade is lighter than its fill. Ink is two steps off
 * black and there is nothing darker in the palette to sit it on, so the
 * edge is the strong rule instead, which reads on paper as the button
 * standing proud of the page rather than as a shadow under it.
 *
 * min-h-14 is 56px, which is both the mockups' primary-button height and
 * comfortably past the 44px floor. Focus comes from the global
 * :focus-visible rule rather than a per-tone ring, so a new tone cannot
 * forget it.
 */
const TONES: Record<Exclude<ChunkyTone, "school">, { cls: string; shade: string }> = {
  ink: {
    cls: "bg-ink text-paper",
    shade: "var(--color-rule-strong)",
  },
  paper: {
    cls: "bg-surface text-ink",
    shade: "var(--color-rule-strong)",
  },
  correct: {
    cls: "bg-correct text-white",
    shade: "var(--color-correct-deep)",
  },
  wrong: {
    cls: "bg-wrong text-white",
    shade: "var(--color-wrong-deep)",
  },
  quiet: {
    cls: "bg-paper text-ink-mid",
    shade: "var(--color-rule)",
  },
};

const SHAPE =
  "chunky inline-flex min-h-14 items-center justify-center rounded-chunky px-8 text-base font-extrabold tracking-wide uppercase disabled:cursor-not-allowed";

function toneStyles(tone: ChunkyTone, school?: SchoolId) {
  if (tone === "school") {
    const s = SCHOOL_CHUNKY[school ?? "stoicism"];
    return { cls: "text-white", style: { ...shade(s.shade), background: s.bg } };
  }
  const t = TONES[tone];
  return { cls: t.cls, style: shade(t.shade) };
}

export interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ChunkyTone;
  school?: SchoolId;
  loading?: boolean;
  /** Replaces the label while `loading`. Defaults to the label itself. */
  loadingLabel?: string;
}

export function ChunkyButton({
  tone = "school",
  school,
  loading = false,
  loadingLabel,
  className = "",
  children,
  disabled,
  ...props
}: ChunkyButtonProps) {
  // A disabled primary keeps the chunky edge but drops to the inert shade,
  // which is how the mockups show "Check" before an option is picked: still
  // clearly a button, visibly not yet usable.
  const inert = disabled || loading;
  const { cls, style } = inert
    ? { cls: "bg-rule text-ink-soft", style: shade("var(--color-rule-strong)") }
    : toneStyles(tone, school);

  return (
    <button
      type="button"
      // A loading button stays focusable and keeps its accessible name; it
      // is `aria-busy` rather than removed from the tree, so a screen
      // reader that was on it does not lose its place. Same contract as the
      // old Button, which this replaces one surface at a time.
      aria-busy={loading || undefined}
      disabled={inert}
      style={style}
      className={`${SHAPE} ${cls} ${className}`}
      {...props}
    >
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}

export interface ChunkyLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  tone?: ChunkyTone;
  school?: SchoolId;
}

// Navigation stays an anchor: making it a button and pushing the router
// loses middle-click, open-in-new-tab and the status-bar URL. Shares the
// shape and tones rather than restating them.
export function ChunkyLink({
  href,
  tone = "school",
  school,
  className = "",
  children,
  ...props
}: ChunkyLinkProps) {
  const { cls, style } = toneStyles(tone, school);
  return (
    <Link href={href} style={style} className={`${SHAPE} ${cls} ${className}`} {...props}>
      {children}
    </Link>
  );
}
