import { customAlphabet } from "nanoid";

// URL-safe, no ambiguous characters, 10 chars — used for quiz_results,
// challenges, and debates (Phase 2) ids that appear in share URLs.
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 10);

export function newId(): string {
  return nanoid();
}
