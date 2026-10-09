import type { Source } from "./footnotes";
import type { SchoolId } from "./types";

/**
 * The distinct authors behind a set of sources, as a readable list.
 *
 * Both halves of a motion's pair cite the same author as often as not, and
 * both of a module's citations usually do, so an undeduplicated join reads
 * "Epictetus, Epictetus". Order is first appearance rather than
 * alphabetical: the first source cited is the one the reading opens on.
 *
 * Pure and `server-only`-free so the module cards, which filter in the
 * browser, can be given their text already assembled.
 */
export function authorList(sources: Source[]): string {
  const authors: string[] = [];
  for (const { author } of sources) {
    if (author && !authors.includes(author)) authors.push(author);
  }
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  return `${authors.slice(0, -1).join(", ")} and ${authors[authors.length - 1]}`;
}

/**
 * The 1-based position of each module among its own school's modules, keyed
 * by module id.
 *
 * The card band reads "Stoicism · Module 1", which is a position within a
 * school and not within the directory: a second Stoic module is Module 2
 * however many Utilitarian ones were added first. Input order decides,
 * which for `getAllModules` is filename order.
 */
export function moduleNumbers(
  modules: { id: string; school: SchoolId }[]
): Record<string, number> {
  const seen: Partial<Record<SchoolId, number>> = {};
  const numbers: Record<string, number> = {};
  for (const { id, school } of modules) {
    const next = (seen[school] ?? 0) + 1;
    seen[school] = next;
    numbers[id] = next;
  }
  return numbers;
}
