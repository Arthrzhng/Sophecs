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

// The muted --color-stoic/utilitarian/virtue tokens (globals.css), meant
// for text/hairlines on paper — not the saturated card-only surfaces
// above. Phase 2's verdict page is the first thing to use them as a
// Tailwind text color; "virtue-ethics" doesn't match its token name
// one-to-one, hence the explicit map instead of a string transform.
export const SCHOOL_TEXT_CLASS: Record<SchoolId, string> = {
  stoicism: "text-stoic",
  utilitarianism: "text-utilitarian",
  "virtue-ethics": "text-virtue",
};
