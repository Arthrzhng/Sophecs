/**
 * A small count as the product writes it in prose: "The three schools",
 * "The other two". Derived from the list it counts, so a heading cannot
 * disagree with the schools under it when a build shows six
 * (docs/stage5-plan.md). Past ten, digits.
 */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export function countWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}
