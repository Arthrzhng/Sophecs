import { CardLayout } from "./CardLayout";
import type { SchoolId } from "@/lib/types";

// No mono: the card holds no measured value, so it has no business setting
// one. Spectral is registered at 400 italic as well as 400/500 roman
// (src/lib/fonts.ts), which is what the quotation and its source need — the
// image routes register the matching italic TTF so both engines shape the
// same face rather than one synthesising a slant.
const WEB_FONTS = {
  serif: "var(--font-spectral), Georgia, serif",
  sans: "var(--font-plex-sans), system-ui, sans-serif",
};

// Web wrapper: the same tree the OG image renders, sized in container-query
// units so it fits whatever column it lands in and stays identical to the
// downloaded/shared versions.
export function ResultCard({
  school,
  oneLine,
  oneLineAttribution,
}: {
  school: SchoolId;
  oneLine: string;
  oneLineAttribution: string;
}) {
  return (
    <div
      style={{ containerType: "inline-size" }}
      // Square and unshadowed. A saturated card at 8:1 against near-white
      // paper already separates; a drop shadow on top is the detail that
      // makes it read as a "card component" rather than a printed object.
      className="w-full overflow-hidden"
    >
      <CardLayout
        school={school}
        oneLine={oneLine}
        oneLineAttribution={oneLineAttribution}
        width={1200}
        height={630}
        fonts={WEB_FONTS}
        unit="cqw"
      />
    </div>
  );
}
