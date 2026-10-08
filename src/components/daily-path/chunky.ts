import type { CSSProperties } from "react";
import type { SchoolId } from "@/lib/types";

/**
 * The shade a chunky control's bottom edge uses, per school.
 *
 * `--sh` has to be an inline custom property: Tailwind can generate a
 * utility for a colour, but not for setting an arbitrary variable that the
 * `.chunky` rule in globals.css then reads. Values are `var()` references
 * rather than hexes so the tokens stay the single source of truth.
 */
export const SCHOOL_CHUNKY: Record<SchoolId, { bg: string; shade: string }> = {
  stoicism: { bg: "var(--color-stoic)", shade: "var(--color-stoic-deep)" },
  utilitarianism: {
    bg: "var(--color-utilitarian)",
    shade: "var(--color-utilitarian-deep)",
  },
  "virtue-ethics": { bg: "var(--color-virtue)", shade: "var(--color-virtue-deep)" },
};

/** The inline style that gives a `.chunky` element its bottom edge. */
export function shade(value: string): CSSProperties {
  return { "--sh": value } as CSSProperties;
}
