import { ImageResponse } from "next/og";
import { loadSerifFont } from "@/lib/og-fonts";
import { OG_INK, OG_PAPER } from "@/lib/card-tokens";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as icon.tsx at the size iOS asks for. Opaque paper rather than
// transparent — iOS composites touch icons onto white and a transparent
// ground would lose the paper tone the rest of the site is built on.
export default async function AppleIcon() {
  const spectral = await loadSerifFont();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: OG_PAPER,
          color: OG_INK,
          fontFamily: "Spectral",
          fontSize: 132,
          fontWeight: 500,
        }}
      >
        S
      </div>
    ),
    { ...size, fonts: [{ name: "Spectral", data: spectral, weight: 500, style: "normal" }] }
  );
}
