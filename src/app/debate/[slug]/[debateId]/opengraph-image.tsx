import { ImageResponse } from "next/og";
import { VerdictCard } from "@/components/debate/VerdictCard";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadOgFonts } from "@/lib/og-fonts";
import { SHOWN_SCHOOL_IDS, type SchoolId } from "@/lib/types";
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

  // As on the result card (src/app/r/[id]/opengraph-image.tsx): without a
  // database the card falls back to a default; with one, a verdict the
  // lookup does not return gets no image and is not cached, rather than a
  // default card cached for a year that would carry no Sample mark.
  let school: SchoolId = "stoicism";
  let motion = "Sophecs";
  let score = 0;
  let sample = false;

  if (isAdminConfigured()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("debates_public")
      .select("school, score, topic_slug, motion_text, is_sample")
      .eq("id", debateId)
      .maybeSingle();
    if (!data) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    // As on the page: no card for a debate in a school this build does not
    // show (one of the three, on a build reverting the launch).
    if (!SHOWN_SCHOOL_IDS.includes(data.school as SchoolId))
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    school = data.school as SchoolId;
    score = Number(data.score ?? 0);
    sample = Boolean(data.is_sample);
    // The stored wording comes from the view with the rest (migration
    // 0020), as on the verdict page; the topic's current motion is the
    // fallback for a debate stored before motion_text existed.
    const { data: topic } = await admin
      .from("debate_topics")
      .select("motion")
      .eq("slug", data.topic_slug)
      .maybeSingle();
    if (topic) {
      motion = motionForDebate(data.motion_text as string | null, topic.motion);
    }
  }

  const [spectral, plexSans, plexMono] = await loadOgFonts();

  return new ImageResponse(
    (
      <VerdictCard
        school={school}
        motion={motion}
        score={score}
        sample={sample}
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
