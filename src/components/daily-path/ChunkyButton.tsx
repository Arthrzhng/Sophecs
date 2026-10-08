import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { SchoolId } from "@/lib/types";
import { SCHOOL_CHUNKY, shade } from "./chunky";

export type ChunkyTone = "school" | "paper" | "correct" | "wrong" | "quiet";

/**
 * The restyle's primary control: a solid bottom edge that the button travels
 * down onto when pressed. The press itself lives in `.chunky` in globals.css
 * so every chunky surface, not only buttons, presses the same way.
 *
 * `school` is the default because the design makes the primary action the
 * reader's own school colour. The school has to be passed in; there is no
 * fallback tone standing in for "no school yet", because a reader without a
 * school has not taken the quiz and sees a different screen.
 *
 * min-h-14 is 56px, which is both the mockups' primary-button height and
 * comfortably past the 44px floor. Focus comes from the global
 * :focus-visible rule rather than a per-tone ring, so a new tone cannot
 * forget it.
 */
const TONES: Record<Exclude<ChunkyTone, "school">, { cls: string; shade: string }> = {
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
}

export function ChunkyButton({
  tone = "school",
  school,
  className = "",
  children,
  disabled,
  ...props
}: ChunkyButtonProps) {
  // A disabled primary keeps the chunky edge but drops to the inert shade,
  // which is how the mockups show "Check" before an option is picked: still
  // clearly a button, visibly not yet usable.
  const { cls, style } = disabled
    ? { cls: "bg-rule text-ink-soft", style: shade("var(--color-rule-strong)") }
    : toneStyles(tone, school);

  return (
    <button
      type="button"
      disabled={disabled}
      style={style}
      className={`${SHAPE} ${cls} ${className}`}
      {...props}
    >
      {children}
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
