import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_ONE_LINES } from "@/lib/school-quotes";
import type { SchoolId, SchoolVector } from "@/lib/types";

export const runtime = "edge";

const SIZE = { width: 1080, height: 1350 };

// TTF, not WOFF2 — see opengraph-image.tsx and docs/decisions.md.
const fontData = Promise.all([
  fetch(new URL("../../../../assets/og-fonts/spectral-500.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  fetch(new URL("../../../../assets/og-fonts/plex-sans-400.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  fetch(new URL("../../../../assets/og-fonts/plex-mono-500.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
]);

// Portrait variant of the same card for Instagram's download-and-post flow.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        width={SIZE.width}
        height={SIZE.height}
        fonts={{ serif: "Spectral", sans: "IBM Plex Sans", mono: "IBM Plex Mono" }}
      />
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
        { name: "IBM Plex Mono", data: plexMono, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
