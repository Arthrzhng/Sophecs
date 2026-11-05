import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadCardFonts } from "@/lib/og-fonts";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

// Node.js runtime, not edge: see docs/decisions.md and card.png/route.tsx —
// the embedded fonts push the edge bundle over Vercel's Hobby-plan 1MB
// Edge Function limit.
export const alt = "Sophecs result card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Without a database (a local build with no keys) the card falls back to
  // Stoicism, unmarked. With one, a result the lookup does not return (a
  // wrong id, a sample removed by teardown, a failed read) gets no image
  // and is not cached, rather than a default card that could be the wrong
  // school, or a sample's without its Sample mark, cached for a year.
  let school: SchoolId = "stoicism";
  let sample = false;

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("public_results")
      .select("school, is_sample")
      .eq("id", id)
      .single();
    if (!data) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    school = data.school as SchoolId;
    sample = Boolean(data.is_sample);
  }

  const [spectral, spectralItalic, plexSans] = await loadCardFonts();

  const content = getSchool(school);

  return new ImageResponse(
    (
      <CardLayout
        school={school}
        oneLine={content.one_line}
        oneLineAttribution={content.one_line_attribution}
        sample={sample}
        width={1200}
        height={630}
        fonts={{ serif: "Spectral", sans: "IBM Plex Sans" }}
      />
    ),
    {
      ...size,
      // Both Spectral styles, registered under one family name so the
      // card's fontStyle: "italic" selects the real italic rather than
      // rendering upright.
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "Spectral", data: spectralItalic, weight: 400, style: "italic" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
