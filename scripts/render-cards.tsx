import React from "react";
import { writeFile, mkdir } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { CardLayout } from "../src/components/card/CardLayout";
import { loadCardFonts } from "../src/lib/og-fonts";
import { getSchool } from "../src/lib/schools";
import type { SchoolId } from "../src/lib/types";

// Renders the result card through Satori for every school, at both
// canvases, without a database. The image routes need a saved result id to
// look a school up; this needs nothing, so the card can be reviewed on its
// own before it ships.
//
//   npx tsx --require ./scripts/preload-server-only-shim.cjs scripts/render-cards.tsx <outdir>

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];
const CANVASES = [
  { tag: "og", width: 1200, height: 630 },
  { tag: "portrait", width: 1080, height: 1350 },
];

async function main() {
  const outDir = process.argv[2] ?? "/tmp/cards";
  await mkdir(outDir, { recursive: true });
  const [spectral, spectralItalic, plexSans] = await loadCardFonts();

  for (const school of SCHOOLS) {
    const content = getSchool(school);
    for (const { tag, width, height } of CANVASES) {
      const response = new ImageResponse(
        (
          <CardLayout
            school={school}
            oneLine={content.one_line}
            oneLineAttribution={content.one_line_attribution}
            width={width}
            height={height}
            fonts={{ serif: "Spectral", sans: "IBM Plex Sans" }}
          />
        ),
        {
          width,
          height,
          fonts: [
            { name: "Spectral", data: spectral, weight: 500, style: "normal" },
            { name: "Spectral", data: spectralItalic, weight: 400, style: "italic" },
            { name: "IBM Plex Sans", data: plexSans, weight: 400, style: "normal" },
          ],
        }
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      const file = `${outDir}/card-${school}-${tag}.png`;
      await writeFile(file, buffer);
      console.log(`${file}  ${buffer.length} bytes`);
    }
  }
}

main();
