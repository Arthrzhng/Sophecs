import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_ONE_LINES } from "@/lib/school-quotes";
import type { SchoolId, SchoolVector } from "@/lib/types";

// Node.js runtime, not edge: the three embedded TTF fonts (~500KB) push this
// route's bundle over Vercel's 1MB Edge Function size limit on the Hobby
// plan (hit in production — see docs/decisions.md). Node functions don't
// have that ceiling; the cold-start cost is a worthwhile trade for actually
// deploying.
const SIZE = { width: 1080, height: 1350 };

// TTF, not WOFF2 — see opengraph-image.tsx and docs/decisions.md. Node
// runtime reads from disk (fetch+import.meta.url is an edge-only pattern).
const fontData = Promise.all([
  readFile(join(process.cwd(), "src/assets/og-fonts/spectral-500.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-sans-400.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-mono-500.ttf")),
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
