import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og-fonts";

export const alt = "Sophecs — which school do you think in?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card for sophecs.com itself. Distinct from /r/[id]'s card, which is a
// saturated school surface: this one is paper, because it belongs to the
// site rather than to any one school. The hairline below is the only place
// on the site where all three school colours appear together — the muted
// tokens, not the card surfaces, since these sit on paper.
const SCHOOL_HAIRLINE = ["#3e5c4b", "#8a6320", "#7a3540"];

export default async function SiteOgImage() {
  const [spectral, plexSans] = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxSizing: "border-box",
          width: size.width,
          height: size.height,
          padding: 90,
          backgroundColor: "#e9e9e3",
          color: "#191917",
          fontFamily: "IBM Plex Sans",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Spectral", fontSize: 30, fontWeight: 600 }}>
          Sophecs
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Spectral",
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            Which school do you think in?
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 28,
              lineHeight: 1.4,
              color: "#54544c",
            }}
          >
            Ten scenarios. Three schools. One result you&apos;ll want to argue about.
          </div>
        </div>

        <div style={{ display: "flex", width: "100%" }}>
          {SCHOOL_HAIRLINE.map((colour) => (
            <div key={colour} style={{ display: "flex", flex: 1, height: 3, backgroundColor: colour }} />
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );
}
