import type { CSSProperties } from "react";
import {
  PUBLISHED_SCHOOL_IDS,
  publishedLookup,
  schoolColourVar,
  schoolShadeVar,
  type SchoolId,
} from "@/lib/school-registry";

/**
 * The shade a chunky control's bottom edge uses, per school.
 *
 * `--sh` has to be an inline custom property: Tailwind can generate a
 * utility for a colour, but not for setting an arbitrary variable that the
 * `.chunky` rule in globals.css then reads. Values are `var()` references
 * rather than hexes so the tokens stay the single source of truth.
 *
 * Built from the registry, which also means a school with no colour token
 * gets a neutral ink control rather than another school's green. Only the
 * published schools are enumerated: this module is imported by
 * ChunkyButton, which is on nearly every page, so anything it enumerates
 * ends up in the client bundle.
 */
export const SCHOOL_CHUNKY: Record<SchoolId, { bg: string; shade: string }> =
  publishedLookup(
    Object.fromEntries(
      PUBLISHED_SCHOOL_IDS.map((id) => [
        id,
        { bg: schoolColourVar(id), shade: schoolShadeVar(id) },
      ])
    ),
    (id) => ({ bg: schoolColourVar(id), shade: schoolShadeVar(id) })
  );

/** The inline style that gives a `.chunky` element its bottom edge. */
export function shade(value: string): CSSProperties {
  return { "--sh": value } as CSSProperties;
}
