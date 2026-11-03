import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { CardLayout } from "@/components/card/CardLayout";
import { loadCardFonts } from "@/lib/og-fonts";
import { getAllSchools } from "@/lib/schools";
import { PUBLISHED_SCHOOL_IDS, type SchoolId } from "@/lib/school-registry";
import { DRAFT_SCHOOL_IDS, knownSchool, schoolDisplayName } from "@/lib/school-registry.drafts";

// A school's result card through Satori, as the OG routes render one, for
// /styleguide/phase3 only. Satori wraps text by its own rules, so a
// one_line that fits on the page can still wrap differently in the image a
// shared link shows; this is where that is checked for all six schools.
// Gated like the page: a 404 unless SOPHECS_PREVIEW was set or this is a
// Vercel preview. Node runtime, as the other image routes are.
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ school: string }> }) {
  const visible = process.env.SOPHECS_PREVIEW === "1" || process.env.VERCEL_ENV === "preview";
  const { school } = await params;
  if (!visible || !knownSchool(school)) return new Response("Not found", { status: 404 });

  const content = getAllSchools({ includeDrafts: true })[school];
  const draft = (DRAFT_SCHOOL_IDS as readonly SchoolId[]).includes(school);
  const surface = draft
    ? (JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "docs/phase3-styleguide/colour-candidates.json"), "utf8")
      ).recommended[school] as string)
    : undefined;
  // The fonts and registrations src/app/r/[id]/opengraph-image.tsx uses.
  const [spectral, spectralItalic, plexSans] = await loadCardFonts();

  return new ImageResponse(
    (
      <CardLayout
        school={school}
        oneLine={content.one_line}
        oneLineAttribution={content.one_line_attribution}
        width={1200}
        height={630}
        fonts={{ serif: "Spectral", sans: "IBM Plex Sans" }}
        surface={surface}
        schoolName={(PUBLISHED_SCHOOL_IDS as readonly SchoolId[]).includes(school) ? undefined : schoolDisplayName(school)}
      />
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Spectral", data: spectral, weight: 500, style: "normal" },
        { name: "Spectral", data: spectralItalic, weight: 400, style: "italic" },
        { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
      ],
    }
  );
}
