import type { SchoolId } from "./types";

/**
 * The result card's design tokens, as literals.
 *
 * Every value here is a copy of a token in globals.css. It is a copy on
 * purpose, for the same reason SiteFooter copies the judge model name
 * rather than importing it: the card renders in two engines with different
 * capabilities, and only one of them can read CSS.
 *
 * On /r/[id] and /quiz/result the card is a normal React tree, where
 * `var(--color-stoic-surface)` would resolve fine. Inside next/og the same
 * tree goes through Satori, which has no stylesheet, no cascade and no
 * custom-property resolution — inline styles with literal values only. A
 * `var()` there resolves to nothing and the card renders as near-white text
 * on a transparent background.
 *
 * So the literals live here, once, and both call sites read them. If a
 * token below changes in globals.css it must change here too, and the
 * styleguide's card row is what catches it: the two are rendered side by
 * side and a drift shows as a colour seam.
 *
 * Tokens mirrored, by their globals.css names:
 *   --color-stoic-surface        #33503f
 *   --color-utilitarian-surface  #7a5518
 *   --color-virtue-surface       #6b2c37
 *   --color-on-saturated         #faf8f2
 */

/** --color-on-saturated. Near-white, very slightly warm. */
export const CARD_INK = "#faf8f2";

/**
 * --color-*-surface. Darker than the --color-stoic / --color-utilitarian /
 * --color-virtue markers used on paper, because these carry near-white text
 * at 8.9 / 8.1 / 8.4 : 1 rather than sitting as text on paper themselves.
 */
export const CARD_SURFACE: Record<SchoolId, string> = {
  stoicism: "#33503f",
  utilitarianism: "#7a5518",
  "virtue-ethics": "#6b2c37",
};

/**
 * The one hairline on the card, as an rgba of CARD_INK. Satori has no
 * colour-mix() and no relative colour syntax, so the alpha is baked.
 */
export const CARD_RULE = "rgba(250, 248, 242, 0.22)";

/**
 * The card's own type scale, as fractions of the card's width.
 *
 * It is a separate scale from the site's six steps on purpose: those are
 * absolute pixel sizes for a 16px-rooted document, and the card has to hold
 * at 1200x630 in a link preview, at 1080x1350 in a story, and at whatever
 * width the column on /r/[id] happens to be. One ratio set, three canvases.
 *
 * Authored against width, never height, so the landscape and portrait
 * renders are the same typography at two sizes rather than two designs.
 */
export const CARD_SCALE = {
  /**
   * The quotation. The card's largest element and the reason it exists.
   *
   * The size is set by line breaking, not by taste. Chromium and Satori
   * shape the same face to very slightly different widths, so a string that
   * lands within about 4% of a line-count boundary can wrap in one engine
   * and not the other — the on-screen card and the shared image then differ
   * by a whole line. At 0.0475 the Epictetus quote measured 0.3% from its
   * boundary and did exactly that: one line in the browser, two in the PNG.
   *
   * At 0.0435 the closest any of the six combinations comes to a boundary
   * is 8.6% (Epictetus, landscape), and the quotes set 1/2/2 lines on the
   * link preview and 2/3/3 on the portrait, in both engines. Changing a
   * one_line in content/schools/*.md means re-checking that margin.
   */
  quote: 0.0435,
  quoteLeading: 1.32,
  /** Source line under the quotation. */
  attribution: 0.021,
  /** The school name. */
  name: 0.059,
  /** The closing line, the only sans on the card. */
  footer: 0.019,
  /** Gaps: quote→source, source→rule, rule→name, block→closing line. */
  gapSource: 0.028,
  gapRule: 0.047,
  gapName: 0.04,
  gapFooter: 0.045,
} as const;

/**
 * What the scale above is a fraction of.
 *
 * Not width, which is the obvious choice and the wrong one. The portrait
 * canvas is narrower than the landscape one (1080 against 1200) and more
 * than twice as tall, so sizing on width alone sets the same type in a
 * frame with 720px more room — the block lands correctly centred and reads
 * as a small paragraph adrift in a large rectangle.
 *
 * Weighting width twice against height once gives 1010 for the link
 * preview and 1170 for the portrait: the same typography, about 16% larger
 * where there is room for it. The measure and the padding stay tied to
 * width, because those are about the column, not the canvas.
 */
export function cardBasis(width: number, height: number): number {
  return (width * 2 + height) / 3;
}

/** Measure for the quotation and the hairline, as a fraction of width. */
export const CARD_MEASURE = 0.88;

/** Padding, as a fraction of width. */
export const CARD_PADDING = 0.066;
