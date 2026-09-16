import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export interface CardFonts {
  serif: string;
  sans: string;
  mono: string;
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
// no user name, no illustration, no decoration beyond a hairline and the
// wordmark.
//
// The card carries identity, not data. It used to print the three-way vector
// as STO/UTI/VIR percentages, which is the one thing a recipient cannot read
// at a glance and the one thing that makes a screenshot look like a
// dashboard. The percentages live on /r/[id], next to a second result, where
// a comparison is actually what they are for.
export function CardLayout({
  school,
  oneLine,
  oneLineAttribution,
  width,
  height,
  fonts,
  unit = "px",
}: CardLayoutProps) {
  const colors = SCHOOL_COLORS[school];
  // Sizes are authored against `width` and converted once, here. Scaling the
  // whole tree with a transform is not an option in pure CSS: scale() needs a
  // unitless number and calc(100cqw / <n>) is a length, so such a declaration
  // is invalid and silently dropped, leaving the card unscaled.
  const u =
    unit === "cqw"
      ? (n: number): string | number => `${((n / width) * 100).toFixed(4)}cqw`
      : (n: number): string | number => n;
  const pad = Math.round(width * 0.075);

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
        backgroundColor: colors.surface,
        color: colors.ink,
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
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: u(Math.round(width * 0.0165)),
            letterSpacing: u(2),
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          Sophecs · Your school
        </div>

        <div
          style={{
            fontFamily: fonts.serif,
            fontSize: u(Math.round(width * 0.078)),
            fontWeight: 500,
            marginTop: u(Math.round(width * 0.02)),
            lineHeight: 1,
            maxWidth: "100%",
            wordBreak: "break-word",
          }}
        >
          {colors.name}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: u(Math.round(width * 0.055)),
            paddingTop: u(Math.round(width * 0.045)),
            borderTop: `1px solid rgba(250,248,242,0.25)`,
            fontFamily: fonts.serif,
            fontSize: u(Math.round(width * 0.026)),
            lineHeight: 1.5,
            maxWidth: u(Math.round(width * 0.78)),
          }}
        >
          <div
            style={{ display: "flex", fontStyle: "italic" }}
          >{`“${oneLine}”`}</div>
          <div
            style={{
              display: "flex",
              fontFamily: fonts.mono,
              fontSize: u(Math.round(width * 0.014)),
              marginTop: u(Math.round(width * 0.018)),
              opacity: 0.85,
            }}
          >
            {`— ${oneLineAttribution}`}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: fonts.sans,
          fontSize: u(Math.round(width * 0.018)),
          marginTop: u(Math.round(width * 0.06)),
          flexShrink: 0,
          opacity: 0.85,
        }}
      >
        Which school do you think in? sophecs.com
      </div>
    </div>
  );
}
