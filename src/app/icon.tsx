import { ImageResponse } from "next/og";
import { loadSerifFont } from "@/lib/og-fonts";

// Node runtime for the same reason as the card routes: the TTF is read from
// disk, which the edge runtime has no filesystem for.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A single Spectral "S", ink on paper. No border, no school colour — the
// schools are tribal markers on a result, not the identity of the site.
export default async function Icon() {
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
          backgroundColor: "#e9e9e3",
          color: "#191917",
          fontFamily: "Spectral",
          fontSize: 26,
          fontWeight: 500,
        }}
      >
        S
      </div>
    ),
    { ...size, fonts: [{ name: "Spectral", data: spectral, weight: 500, style: "normal" }] }
  );
}
