import { SCHOOL_COLORS } from "@/lib/school-colors";
import {
  CARD_INK,
  CARD_MEASURE,
  CARD_PADDING,
  CARD_RULE,
  CARD_SCALE,
  CARD_SURFACE,
  cardBasis,
} from "@/lib/card-tokens";
import type { SchoolId } from "@/lib/types";

export interface CardFonts {
  serif: string;
  sans: string;
}

export interface CardLayoutProps {
  school: SchoolId;
  oneLine: string;
  oneLineAttribution: string;
  width: number;
  height: number;
  fonts: CardFonts;
  // "cqw" expresses every size as a fraction of the nearest container's inline
  // size, so the web card scales to whatever column it lands in. Satori has no
  // container queries, so the image routes keep raw pixels (the default).
  unit?: "px" | "cqw";
}

// Pure — no hooks, inline styles only, every size derived from `width` — so
// this exact tree renders identically on /r/[id] and inside next/og's
// ImageResponse (Satori). The only fully saturated surface in the product;
// no user name, no illustration, no decoration beyond a hairline.
//
// The card carries identity, not data. It used to print the three-way vector
// as STO/UTI/VIR percentages, which is the one thing a recipient cannot read
// at a glance and the one thing that makes a screenshot look like a
// dashboard. The percentages live on /r/[id], next to a second result, where
// a comparison is actually what they are for.
//
// The quotation leads and the school name resolves it. That ordering is the
// card's one deliberate typographic risk: a label with a caption under it is
// a badge, and a badge is what every quiz result on the internet looks like.
// A sentence in Spectral italic with its source under it, and the name set
// below the rule, is a book plate — you read it before you know what it is
// labelling, which is the right order for a sentence worth reading.
//
// There is no mono on this card. Mono is for measured values and the card
// holds no number; the eyebrow it used to set in mono small caps
// ("SOPHECS · YOUR SCHOOL") is gone entirely rather than restyled, because
// with the quotation leading and the wordmark closing there was nothing left
// for it to say.
export function CardLayout({
  school,
  oneLine,
  oneLineAttribution,
  width,
  height,
  fonts,
  unit = "px",
}: CardLayoutProps) {
  // Sizes are authored against `width` and converted once, here. Scaling the
  // whole tree with a transform is not an option in pure CSS: scale() needs a
  // unitless number and calc(100cqw / <n>) is a length, so such a declaration
  // is invalid and silently dropped, leaving the card unscaled.
  const u =
    unit === "cqw"
      ? (n: number): string | number => `${((n / width) * 100).toFixed(4)}cqw`
      : (n: number): string | number => Math.round(n);
  // Type sizes come off the basis, the column off the width. See
  // cardBasis() for why those are not the same number.
  const basis = cardBasis(width, height);
  const pad = width * CARD_PADDING;
  const measure = width * CARD_MEASURE;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // space-between, not center: the same tree has to sit well on a
        // 1200x630 link preview and a 1080x1350 portrait. Centring a short
        // block on the portrait canvas leaves a third of the card empty
        // under it. Here the identity block holds the optical centre and
        // the closing line is pinned to the bottom edge, so the extra
        // height becomes deliberate space rather than a gap.
        justifyContent: "space-between",
        boxSizing: "border-box",
        width: u(width),
        height: u(height),
        padding: u(pad),
        backgroundColor: CARD_SURFACE[school],
        color: CARD_INK,
        fontFamily: fonts.sans,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        {/* The quotation. Spectral italic, set to a measure rather than to
            the card edge, with typographic quotes. Satori has no ::before,
            so the marks are in the string. */}
        <div
          style={{
            display: "flex",
            fontFamily: fonts.serif,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: u(basis * CARD_SCALE.quote),
            lineHeight: CARD_SCALE.quoteLeading,
            maxWidth: u(measure),
          }}
        >
          {`“${oneLine}”`}
        </div>

        {/* Source, not a byline: no em-dash prefix, no mono, no brackets.
            Spectral italic one step down, so the quotation and its source
            read as one typeset block. */}
        <div
          style={{
            display: "flex",
            fontFamily: fonts.serif,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: u(basis * CARD_SCALE.attribution),
            lineHeight: 1.45,
            marginTop: u(basis * CARD_SCALE.gapSource),
            maxWidth: u(measure),
            opacity: 0.8,
          }}
        >
          {oneLineAttribution}
        </div>

        {/* The one hairline. Same structural device as the rest of the site,
            at the one place on the card where the sentence ends and the
            label begins. */}
        <div
          style={{
            display: "flex",
            width: u(measure),
            height: u(1),
            marginTop: u(basis * CARD_SCALE.gapRule),
            backgroundColor: CARD_RULE,
          }}
        />

        <div
          style={{
            fontFamily: fonts.serif,
            fontStyle: "normal",
            fontWeight: 500,
            fontSize: u(basis * CARD_SCALE.name),
            lineHeight: 1.05,
            marginTop: u(basis * CARD_SCALE.gapName),
            maxWidth: "100%",
            wordBreak: "break-word",
          }}
        >
          {SCHOOL_COLORS[school].name}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: fonts.sans,
          fontSize: u(basis * CARD_SCALE.footer),
          marginTop: u(basis * CARD_SCALE.gapFooter),
          flexShrink: 0,
          opacity: 0.75,
        }}
      >
        Which school do you think in? sophecs.com
      </div>
    </div>
  );
}
