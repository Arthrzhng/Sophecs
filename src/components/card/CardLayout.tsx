import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId, SchoolVector } from "@/lib/types";

export interface CardFonts {
  serif: string;
  sans: string;
  mono: string;
}

export interface CardLayoutProps {
  school: SchoolId;
  oneLine: string;
  oneLineAttribution: string;
  vector: SchoolVector;
  width: number;
  height: number;
  fonts: CardFonts;
  // "cqw" expresses every size as a fraction of the nearest container's inline
  // size, so the web card scales to whatever column it lands in. Satori has no
  // container queries, so the image routes keep raw pixels (the default).
  unit?: "px" | "cqw";
}

const LABELS: Record<SchoolId, string> = {
  stoicism: "STO",
  utilitarianism: "UTI",
  "virtue-ethics": "VIR",
};

const ORDER: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// Pure — no hooks, inline styles only, every size derived from `width` — so
// this exact tree renders identically on /r/[id] and inside next/og's
// ImageResponse (Satori). The only fully saturated surface in the product;
// no user name, no illustration, no decoration beyond a hairline and the
// wordmark.
export function CardLayout({
  school,
  oneLine,
  oneLineAttribution,
  vector,
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
        justifyContent: "center",
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
          fontFamily: fonts.mono,
          fontSize: u(Math.round(width * 0.0165)),
          letterSpacing: u(2),
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        Assigned school
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
          gap: u(Math.round(width * 0.045)),
          marginTop: u(Math.round(width * 0.045)),
          fontFamily: fonts.mono,
          fontSize: u(Math.round(width * 0.019)),
        }}
      >
        {ORDER.map((id) => (
          <div key={id} style={{ display: "flex", gap: u(6) }}>
            <span style={{ opacity: 0.85 }}>{LABELS[id]}</span>
            <span style={{ fontWeight: 500 }}>{Math.round(vector[id] * 100)}%</span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: u(Math.round(width * 0.05)),
          paddingTop: u(Math.round(width * 0.045)),
          borderTop: `1px solid rgba(250,248,242,0.25)`,
          fontFamily: fonts.serif,
          fontSize: u(Math.round(width * 0.026)),
          lineHeight: 1.5,
          maxWidth: u(Math.round(width * 0.78)),
        }}
      >
        <div style={{ display: "flex", fontStyle: "italic" }}>{`“${oneLine}”`}</div>
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

      <div
        style={{
          display: "flex",
          fontFamily: fonts.serif,
          fontWeight: 600,
          fontSize: u(Math.round(width * 0.018)),
          marginTop: u(Math.round(width * 0.06)),
          opacity: 0.85,
        }}
      >
        sophecs.com
      </div>
    </div>
  );
}
