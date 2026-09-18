import type { SchoolId } from "./types";

/** The three school ids, as a runtime list for validating content files. */
export const SCHOOL_IDS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

export interface Source {
  author: string;
  work: string;
  section?: string;
}

/** A source with the number it is cited by, ready to render in a list. */
export interface NumberedSource extends Source {
  n: number;
}

export type Piece = { text: string } | { note: number };

/**
 * Splits a paragraph into text and footnote markers.
 *
 * Markers are written `[^1]` in the content file and number into the
 * passage's `sources` list in order, so `[^1]` is the first source. A
 * marker with no matching source is left as literal text rather than
 * rendered as a dead superscript — a citation that points nowhere is worse
 * than one that was never made, and leaving it visible is how the author
 * finds out.
 *
 * Pure, and free of `server-only`: the reading view is a client component
 * because it remembers scroll position, so it needs this in the browser.
 */
export function parseFootnotes(paragraph: string, sourceCount: number): Piece[] {
  const pieces: Piece[] = [];
  const pattern = /\[\^(\d+)\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(paragraph)) !== null) {
    const n = Number(match[1]);
    if (n < 1 || n > sourceCount) continue; // left as literal text below
    if (match.index > cursor) {
      pieces.push({ text: paragraph.slice(cursor, match.index) });
    }
    pieces.push({ note: n });
    cursor = match.index + match[0].length;
  }
  if (cursor < paragraph.length) pieces.push({ text: paragraph.slice(cursor) });
  return pieces;
}

/** True when any paragraph carries a marker that resolves to a source. */
export function hasFootnotes(body: string, sourceCount: number): boolean {
  return body
    .split("\n\n")
    .some((p) => parseFootnotes(p, sourceCount).some((piece) => "note" in piece));
}

export function numberSources(sources: Source[]): NumberedSource[] {
  return sources.map((s, i) => ({ ...s, n: i + 1 }));
}

export function formatSource(source: Source): string {
  return [source.author, source.work, source.section].filter(Boolean).join(", ");
}

/**
 * Reading time in whole minutes at 200 words per minute, never less than
 * one. The passages are 226–250 words each, so every topic comes out at
 * "4 min" for its pair — uniform, and honest about being uniform rather
 * than dressed up with invented variance.
 */
export function readingMinutes(...bodies: string[]): number {
  const words = bodies.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
