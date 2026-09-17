import type { SchoolId } from "./types";

/**
 * The result card's design tokens, as literals.
 *
 * Every colour here is a copy of a token in globals.css. It is a copy on
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
 * The card's type scale, as fractions of the card's width.
 *
 * Every field is a fraction so one tree serves both image canvases and
 * whatever width the column on /r/[id] happens to be. The scale is not the
 * site's six steps: those are absolute pixel sizes for a 16px-rooted
 * document, and none of the three surfaces this renders on is one.
 */
export interface CardScale {
  /** The quotation, and its leading. */
  quote: number;
  quoteLeading: number;
  /** The source line under the quotation. */
  source: number;
  /** The school name. */
  name: number;
  /** The closing block: the question, then the address. */
  closingQuestion: number;
  closingUrl: number;
  /** Gaps: quote→source, source→rule, rule→name, name→closing, question→url. */
  gapSource: number;
  gapRule: number;
  gapName: number;
  gapClosing: number;
  gapUrl: number;
}

/**
 * 1200x630 — the link preview, and the aspect the on-screen card uses.
 *
 * Sizes in pixels at that width: quote 44, source 21, name 60, question 24,
 * address 46. Visibility runs name → address → quote → question → source,
 * which is the order the card is read in once it is small enough that only
 * two things land: whose school, and where to go.
 *
 * The quote size is set by line breaking, not taste. This is the only
 * canvas the card renders on in a browser as well as in Satori, and the
 * two shape the same face to slightly different widths — a string sitting
 * near a line-count boundary wraps in one and not the other, and the
 * on-screen card and the shared image then differ by a whole line. At
 * 0.0475 the Epictetus quote sat right on its boundary and did exactly
 * that: one line in the browser, two in the PNG.
 *
 * Measured by laying each string out and shrinking the box until the count
 * changes — dividing total width by the box underestimates, because greedy
 * wrapping wastes whatever a word does not fill:
 *
 *   quote  44px   Epictetus 1 line   (box can shrink 9% before it breaks)
 *                 Bentham   2 lines  (14%)
 *                 Aristotle 2 lines  (17%)
 *   source 21px   all three 1 line   (Bentham tightest, 39%)
 *
 * None of them changes count if the box grows, at any width up to +40%.
 * Satori's divergence from Chromium measures well under 1% here, so 9% is
 * a wide margin. Editing a one_line in content/schools/*.md means
 * re-deriving these.
 */
export const CARD_SCALE_LANDSCAPE: CardScale = {
  quote: 0.036667,
  quoteLeading: 1.32,
  source: 0.0175,
  name: 0.05,
  closingQuestion: 0.02,
  closingUrl: 0.038333,
  gapSource: 0.023333,
  gapRule: 0.039167,
  gapName: 0.033333,
  gapClosing: 0.025,
  gapUrl: 0.006667,
};

/**
 * 1080x1350 — the portrait download, sized for its own canvas rather than
 * scaled off the landscape one.
 *
 * It is a different design at the same typographic weights, because it is a
 * different object: a story frame someone looks at full-bleed, not a
 * thumbnail in a feed. The name carries it, at 136px against the address's
 * 105 and the quotation's 70 — the quotation leads in reading order but no
 * longer in size, which is what "fills the canvas" costs on a frame this
 * tall. Most of the extra height goes into the gaps rather than the type.
 *
 * Line-count margins re-derived for this canvas against its own 938px
 * measure. They do not follow from the landscape ones: both the sizes and
 * the box are different, and so are the counts.
 *
 *   quote   70px   Epictetus 2 lines  (shrink 20% / grow >40%)
 *                  Bentham   4 lines  (shrink 16% / grow  6%)
 *                  Aristotle 4 lines  (shrink 21% / grow  6%)
 *   source  28px   all three 1 line   (Bentham tightest, shrink 9%)
 *
 * 6% is the tightest margin on the card and it is still an order of
 * magnitude more than the two engines differ by. Nothing renders this
 * canvas in a browser — /r/[id] and /quiz/result are always 1200x630 —
 * so these margins guard against an edited quote reflowing, not against
 * the two engines disagreeing.
 *
 * The source is 28px rather than 32 for that reason: at 30px Bentham's
 * citation lands 2% from wrapping to a second line.
 */
export const CARD_SCALE_PORTRAIT: CardScale = {
  quote: 0.064815,
  quoteLeading: 1.32,
  source: 0.025926,
  name: 0.125926,
  closingQuestion: 0.037037,
  closingUrl: 0.097222,
  gapSource: 0.051852,
  gapRule: 0.111111,
  gapName: 0.097222,
  gapClosing: 0.12963,
  gapUrl: 0.018519,
};

/** Portrait past square, landscape otherwise. */
export function cardScale(width: number, height: number): CardScale {
  return height > width ? CARD_SCALE_PORTRAIT : CARD_SCALE_LANDSCAPE;
}

/** Measure for the quotation and the hairline, as a fraction of width. */
export const CARD_MEASURE = 0.88;

/** Padding, as a fraction of width. */
export const CARD_PADDING = 0.066;
