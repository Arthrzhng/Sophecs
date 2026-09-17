import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadCardFonts } from "@/lib/og-fonts";
import { getSchool } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

// Node.js runtime, not edge: the three embedded TTF fonts (~500KB) push this
// route's bundle over Vercel's 1MB Edge Function size limit on the Hobby
// plan (hit in production — see docs/decisions.md). Node functions don't
// have that ceiling; the cold-start cost is a worthwhile trade for actually
// deploying.
const SIZE = { width: 1080, height: 1350 };

// Portrait variant of the same card for Instagram's download-and-post flow.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spectral, spectralItalic, plexSans] = await loadCardFonts();

  let school: SchoolId = "stoicism";

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("public_results")
      .select("school")
      .eq("id", id)
      .single();
    if (data) {
      school = data.school as SchoolId;
    }
  }

  const content = getSchool(school);

  return new ImageResponse(
    (
      <CardLayout
        school={school}
        oneLine={content.one_line}
        oneLineAttribution={content.one_line_attribution}
        width={SIZE.width}
        height={SIZE.height}
        fonts={{ serif: "Spectral", sans: "IBM Plex Sans" }}
      />
    ),
    {
      ...SIZE,
      // Both Spectral styles under one family name — see the landscape
      // route. Without the italic registered, Satori renders the quotation
      // upright while the web card shows it slanted.
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "Spectral", data: spectralItalic, weight: 400, style: "italic" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
