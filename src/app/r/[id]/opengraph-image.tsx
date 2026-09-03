import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_ONE_LINES } from "@/lib/school-quotes";
import type { SchoolId, SchoolVector } from "@/lib/types";

// Node.js runtime, not edge: see docs/decisions.md and card.png/route.tsx —
// the embedded fonts push the edge bundle over Vercel's Hobby-plan 1MB
// Edge Function limit.
export const alt = "Sophecs result card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Loaded once at module scope, not per request. TTF, not WOFF2 — Satori
// (the engine behind ImageResponse) can't parse WOFF2, only TTF/OTF/WOFF;
// see docs/decisions.md. These are separate files from the WOFF2 set
// next/font/local uses for the live site. Node runtime reads them from
// disk (fetch+import.meta.url is an edge-only pattern).
const fontData = Promise.all([
  readFile(join(process.cwd(), "src/assets/og-fonts/spectral-500.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-sans-400.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-mono-500.ttf")),
]);

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spectral, plexSans, plexMono] = await fontData;

  let school: SchoolId = "stoicism";
  let vector: SchoolVector = { stoicism: 1, utilitarianism: 0, "virtue-ethics": 0 };

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("public_results")
      .select("school, vector")
      .eq("id", id)
      .single();
    if (data) {
      school = data.school as SchoolId;
      vector = data.vector as SchoolVector;
    }
  }

  const oneLine = SCHOOL_ONE_LINES[school];

  return new ImageResponse(
    (
      <CardLayout
        school={school}
        oneLine={oneLine.text}
        oneLineAttribution={oneLine.attribution}
        vector={vector}
        width={1200}
        height={630}
        fonts={{ serif: "Spectral", sans: "IBM Plex Sans", mono: "IBM Plex Mono" }}
      />
    ),
    {
      ...size,
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
        { name: "IBM Plex Mono", data: plexMono, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
