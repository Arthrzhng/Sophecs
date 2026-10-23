import { ImageResponse } from "next/og";
import { VerdictCard } from "@/components/debate/VerdictCard";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadOgFonts } from "@/lib/og-fonts";
import type { SchoolId } from "@/lib/types";
import { motionForDebate } from "@/lib/motion-text";

// Node runtime (not edge) — see docs/decisions.md and r/[id]/opengraph-image.tsx:
// the embedded fonts push an edge bundle over Vercel Hobby's 1MB limit.
export const alt = "Sophecs debate verdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function VerdictOGImage({
  params,
}: {
  params: Promise<{ slug: string; debateId: string }>;
}) {
  const { debateId } = await params;
  const [spectral, plexSans, plexMono] = await loadOgFonts();

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
      // Same two reads as the verdict page, and for the same reason:
      // `debates_public` does not carry `motion_text`, so the stored
      // wording comes from `debates` instead of from a migration.
      const [{ data: topic }, { data: storedMotion }] = await Promise.all([
        admin.from("debate_topics").select("motion").eq("slug", data.topic_slug).maybeSingle(),
        admin.from("debates").select("motion_text").eq("id", debateId).maybeSingle(),
      ]);
      if (topic) {
        motion = motionForDebate(storedMotion?.motion_text as string | null, topic.motion);
      }
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
