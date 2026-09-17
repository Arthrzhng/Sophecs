import { CARD_INK, CARD_SURFACE } from "./card-tokens";
import type { SchoolId } from "./types";

// The saturated surfaces are read from card-tokens.ts, not restated here:
// that file is the single place the globals.css literals are mirrored for
// Satori, and two copies of the same hex is exactly the drift it exists to
// prevent. What this map adds is the display name, which is not a token.
export const SCHOOL_COLORS: Record<
  SchoolId,
  { surface: string; ink: string; name: string }
> = {
  stoicism: { surface: CARD_SURFACE.stoicism, ink: CARD_INK, name: "Stoicism" },
  utilitarianism: {
    surface: CARD_SURFACE.utilitarianism,
    ink: CARD_INK,
    name: "Utilitarianism",
  },
  "virtue-ethics": {
    surface: CARD_SURFACE["virtue-ethics"],
    ink: CARD_INK,
    name: "Virtue Ethics",
  },
};

// What you call a person who argues from a school, as opposed to the
// school's own name. "What a Stoic would say" reads; "what a Stoicism would
// say" does not, and a naive lowercase of the name gets it wrong for all
// three.
export const SCHOOL_ADHERENT: Record<SchoolId, string> = {
  stoicism: "Stoic",
  utilitarianism: "Utilitarian",
  "virtue-ethics": "Virtue Ethicist",
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
