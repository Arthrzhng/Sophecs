import { CARD_INK, CARD_SURFACE } from "./card-tokens";
import {
  ALL_SCHOOL_IDS,
  schoolAdherent,
  schoolAdherentPlural,
  schoolName,
  totalOverSchools,
  type SchoolId,
} from "./school-registry";

// Every map here is built from the registry rather than written out, so a
// school cannot be in the product and missing from one of them. What each
// map adds on top of the registry is noted where it is defined.
//
// The saturated surfaces are read from card-tokens.ts, not restated here:
// that file is the single place the globals.css literals are mirrored for
// Satori, and two copies of the same hex is exactly the drift it exists to
// prevent. What this map adds is the display name, which is not a token.
export const SCHOOL_COLORS: Record<
  SchoolId,
  { surface: string; ink: string; name: string }
> = Object.fromEntries(
  ALL_SCHOOL_IDS.map((id) => [
    id,
    { surface: CARD_SURFACE[id], ink: CARD_INK, name: schoolName(id) },
  ])
) as Record<SchoolId, { surface: string; ink: string; name: string }>;

// What you call a person who argues from a school, as opposed to the
// school's own name. "What a Stoic would say" reads; "what a Stoicism would
// say" does not, and a naive lowercase of the name gets it wrong for all
// three. The nouns themselves are in the registry; a school that has none
// falls back to its name, and `tests/school-registry.test.ts` fails if a
// published school reaches that fallback.
export const SCHOOL_ADHERENT: Record<SchoolId, string> = Object.fromEntries(
  ALL_SCHOOL_IDS.map((id) => [id, schoolAdherent(id)])
) as Record<SchoolId, string>;

// The same, in the plural, for talking about a school's side rather than
// one of its arguers: "+1 for the Stoics on the table".
export const SCHOOL_ADHERENT_PLURAL: Record<SchoolId, string> =
  Object.fromEntries(
    ALL_SCHOOL_IDS.map((id) => [id, schoolAdherentPlural(id)])
  ) as Record<SchoolId, string>;

// The muted --color-stoic/utilitarian/virtue tokens (globals.css), meant
// for text/hairlines on paper — not the saturated card-only surfaces
// above. Phase 2's verdict page is the first thing to use them as a
// Tailwind text color; "virtue-ethics" doesn't match its token name
// one-to-one, hence the explicit map instead of a string transform.
//
// This one stays a literal map rather than being derived from the
// registry's `colourToken`, and the reason is Tailwind: v4 finds the
// utilities it needs by scanning source for class strings, so a
// `text-${token}` built at runtime would compile and then render with no
// colour at all. A school with no class of its own gets `text-ink`.
const TEXT_CLASS_BY_SCHOOL: Partial<Record<SchoolId, string>> = {
  stoicism: "text-stoic",
  utilitarianism: "text-utilitarian",
  "virtue-ethics": "text-virtue",
};

export const SCHOOL_TEXT_CLASS: Record<SchoolId, string> = totalOverSchools(
  TEXT_CLASS_BY_SCHOOL,
  "text-ink"
);
