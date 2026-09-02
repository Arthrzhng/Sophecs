import { CardLayout } from "./CardLayout";
import type { SchoolId, SchoolVector } from "@/lib/types";

const WEB_FONTS = {
  serif: "var(--font-spectral), Georgia, serif",
  sans: "var(--font-plex-sans), system-ui, sans-serif",
  mono: "var(--font-plex-mono), ui-monospace, monospace",
};

// Web wrapper: fixed intrinsic size (matches the OG image's proportions),
// scaled to its container via CSS so it stays crisp and identical to the
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
      {/* Fixed 1200x630 intrinsic size, scaled to the container's actual
          width with container query units — pure CSS, no measurement JS. */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1200 / 630" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: 1200,
            height: 630,
            transform: "scale(calc(100cqw / 1200))",
            transformOrigin: "top left",
          }}
        >
          <CardLayout
            school={school}
            oneLine={oneLine}
            oneLineAttribution={oneLineAttribution}
            vector={vector}
            width={1200}
            height={630}
            fonts={WEB_FONTS}
          />
        </div>
      </div>
    </div>
  );
}
