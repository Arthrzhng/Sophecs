import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { VerdictCard } from "@/components/debate/VerdictCard";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { SchoolId } from "@/lib/types";

// Node runtime (not edge) — see docs/decisions.md and r/[id]/opengraph-image.tsx:
// the embedded fonts push an edge bundle over Vercel Hobby's 1MB limit.
export const alt = "Sophecs debate verdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontData = Promise.all([
  readFile(join(process.cwd(), "src/assets/og-fonts/spectral-500.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-sans-400.ttf")),
  readFile(join(process.cwd(), "src/assets/og-fonts/plex-mono-500.ttf")),
]);

export default async function VerdictOGImage({
  params,
}: {
  params: Promise<{ slug: string; debateId: string }>;
}) {
  const { debateId } = await params;
  const [spectral, plexSans, plexMono] = await fontData;

  let school: SchoolId = "stoicism";
  let motion = "Sophecs";
  let score = 0;

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("debates_public")
      .select("school, score, topic_slug")
      .eq("id", debateId)
      .maybeSingle();
    if (data) {
      school = data.school as SchoolId;
      score = Number(data.score ?? 0);
      const { data: topic } = await admin
        .from("debate_topics")
        .select("motion")
        .eq("slug", data.topic_slug)
        .maybeSingle();
      if (topic) motion = topic.motion;
    }
  }

  return new ImageResponse(
    (
      <VerdictCard
        school={school}
        motion={motion}
        score={score}
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
