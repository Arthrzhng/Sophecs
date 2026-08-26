import { schoolColor, schoolName } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

// Colour is allegiance: a school shows up as a dot, a stripe, or an eyebrow
// label, and nowhere else. These three components are the only places school
// colour enters the interface outside the quiz result card.

export function SchoolDot({ school }: { school: SchoolId }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 rounded-full shrink-0"
      style={{ backgroundColor: schoolColor(school) }}
    />
  );
}

export function SchoolStripe({ school }: { school: SchoolId }) {
  return (
    <span
      aria-hidden
      className="inline-block w-[3px] self-stretch rounded-full shrink-0"
      style={{ backgroundColor: schoolColor(school) }}
    />
  );
}

export function SchoolEyebrow({ school }: { school: SchoolId }) {
  return (
    <span className="eyebrow" style={{ color: schoolColor(school) }}>
      {schoolName(school)}
    </span>
  );
}
