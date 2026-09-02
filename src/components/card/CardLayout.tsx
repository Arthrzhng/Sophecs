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
}

const LABELS: Record<SchoolId, string> = {
  stoicism: "STO",
  utilitarianism: "UTI",
  "virtue-ethics": "VIR",
};

const ORDER: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// Pure — no hooks, inline styles only, all sizes derived from `width` — so
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
}: CardLayoutProps) {
  const colors = SCHOOL_COLORS[school];
  const pad = Math.round(width * 0.075);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width,
        height,
        padding: pad,
        backgroundColor: colors.surface,
        color: colors.ink,
        fontFamily: fonts.sans,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: Math.round(width * 0.0165),
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        Assigned school
      </div>

      <div
        style={{
          fontFamily: fonts.serif,
          fontSize: Math.round(width * 0.078),
          fontWeight: 500,
          marginTop: Math.round(width * 0.02),
          lineHeight: 1,
        }}
      >
        {colors.name}
      </div>

      <div
        style={{
          display: "flex",
          gap: Math.round(width * 0.045),
          marginTop: Math.round(width * 0.045),
          fontFamily: fonts.mono,
          fontSize: Math.round(width * 0.019),
        }}
      >
        {ORDER.map((id) => (
          <div key={id} style={{ display: "flex", gap: 6 }}>
            <span style={{ opacity: 0.85 }}>{LABELS[id]}</span>
            <span style={{ fontWeight: 500 }}>{Math.round(vector[id] * 100)}%</span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: Math.round(width * 0.05),
          paddingTop: Math.round(width * 0.045),
          borderTop: `1px solid rgba(250,248,242,0.25)`,
          fontFamily: fonts.serif,
          fontSize: Math.round(width * 0.026),
          lineHeight: 1.5,
          maxWidth: Math.round(width * 0.78),
        }}
      >
        <div style={{ display: "flex", fontStyle: "italic" }}>{`“${oneLine}”`}</div>
        <div
          style={{
            display: "flex",
            fontFamily: fonts.mono,
            fontSize: Math.round(width * 0.014),
            marginTop: Math.round(width * 0.018),
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
          fontSize: Math.round(width * 0.018),
          marginTop: Math.round(width * 0.06),
          opacity: 0.85,
        }}
      >
        sophecs.com
      </div>
    </div>
  );
}
