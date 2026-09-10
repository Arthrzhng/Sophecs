import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadOgFonts } from "@/lib/og-fonts";
import { SCHOOL_ONE_LINES } from "@/lib/school-quotes";
import type { SchoolId, SchoolVector } from "@/lib/types";

// Node.js runtime, not edge: see docs/decisions.md and card.png/route.tsx —
// the embedded fonts push the edge bundle over Vercel's Hobby-plan 1MB
// Edge Function limit.
export const alt = "Sophecs result card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spectral, plexSans, plexMono] = await loadOgFonts();

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
