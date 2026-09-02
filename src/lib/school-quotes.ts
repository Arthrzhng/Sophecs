import type { SchoolId } from "./types";

// Edge-safe duplicate of content/schools/*.md's one_line/one_line_attribution
// fields. The markdown frontmatter is the source of truth for everything
// else (the ~200-word read, gets_wrong, share_lines) and is read via
// src/lib/schools.ts's fs-based loader on Node.js-runtime pages — but the OG
// image and portrait card routes run on the edge (no fs), so the two short
// fields needed on the card itself are mirrored here by hand. Keep these in
// sync with the markdown if the quotes ever change — see docs/decisions.md.
export const SCHOOL_ONE_LINES: Record<SchoolId, { text: string; attribution: string }> = {
  stoicism: {
    text: "Of things some are in our power, and others are not.",
    attribution: "Epictetus, Enchiridion, ch. 1",
  },
  utilitarianism: {
    text: "Nature has placed mankind under the governance of two sovereign masters, pain and pleasure.",
    attribution: "Bentham, Principles of Morals and Legislation, ch. I",
  },
  "virtue-ethics": {
    text: "We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.",
    attribution: "Aristotle, Nicomachean Ethics, Book II, ch. 1",
  },
};
