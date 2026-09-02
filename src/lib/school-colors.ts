import type { SchoolId } from "./types";

// Duplicated from globals.css's @theme tokens on purpose: CardLayout renders
// both as a normal React tree (where the CSS vars would resolve fine) and
// inside next/og's ImageResponse (Satori — no CSS custom property
// resolution, no external stylesheet, inline styles with literal values
// only). Keeping one canonical hex map here means both call sites agree.
export const SCHOOL_COLORS: Record<
  SchoolId,
  { surface: string; ink: string; name: string }
> = {
  stoicism: { surface: "#33503f", ink: "#faf8f2", name: "Stoicism" },
  utilitarianism: { surface: "#7a5518", ink: "#faf8f2", name: "Utilitarianism" },
  "virtue-ethics": { surface: "#6b2c37", ink: "#faf8f2", name: "Virtue Ethics" },
};
