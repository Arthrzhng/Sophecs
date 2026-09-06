import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

// The share surface for a verdict — paper, not saturated, per the brief:
// the quiz result card stays the one loud object in the product. Renders
// identically as a normal React tree (web) or inside next/og's
// ImageResponse (Satori — literal values only, explicit display:flex on
// every multi-child div), same dual-rendering approach as card/CardLayout.
export function VerdictCard({
  school,
  motion,
  score,
  width,
  height,
  fonts,
}: {
  school: SchoolId;
  motion: string;
  score: number;
  width: number;
  height: number;
  fonts: { serif: string; sans: string; mono: string };
}) {
  const color = SCHOOL_COLORS[school];
  const scale = width / 1200;
  const px = (n: number) => Math.round(n * scale);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width,
        height,
        padding: px(64),
        backgroundColor: "#e9e9e3",
        color: "#191917",
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ display: "flex", width: px(64), height: 3, backgroundColor: color.surface }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: px(20), marginTop: px(28) }}>
        <span style={{ fontFamily: fonts.mono, fontSize: px(72), fontWeight: 500 }}>{score}</span>
        <span style={{ fontFamily: fonts.mono, fontSize: px(20), color: "#63635b" }}>/ 100</span>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: fonts.serif,
          fontSize: px(30),
          lineHeight: 1.3,
          marginTop: px(28),
          maxWidth: px(980),
        }}
      >
        {motion}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: fonts.mono,
          fontSize: px(18),
          color: "#63635b",
          marginTop: px(40),
        }}
      >
        sophecs.com
      </div>
    </div>
  );
}
