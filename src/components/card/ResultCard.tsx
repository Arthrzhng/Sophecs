import { CardLayout } from "./CardLayout";
import type { SchoolId, SchoolVector } from "@/lib/types";

const WEB_FONTS = {
  serif: "var(--font-spectral), Georgia, serif",
  sans: "var(--font-plex-sans), system-ui, sans-serif",
  mono: "var(--font-plex-mono), ui-monospace, monospace",
};

// Web wrapper: the same tree the OG image renders, sized in container-query
// units so it fits whatever column it lands in and stays identical to the
// downloaded/shared versions.
export function ResultCard({
  school,
  oneLine,
  oneLineAttribution,
  vector,
}: {
  school: SchoolId;
  oneLine: string;
  oneLineAttribution: string;
  vector: SchoolVector;
}) {
  return (
    <div
      style={{ containerType: "inline-size" }}
      className="w-full rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(25,25,23,0.08),0_8px_24px_rgba(25,25,23,0.12)]"
    >
      <CardLayout
        school={school}
        oneLine={oneLine}
        oneLineAttribution={oneLineAttribution}
        vector={vector}
        width={1200}
        height={630}
        fonts={WEB_FONTS}
        unit="cqw"
      />
    </div>
  );
}
