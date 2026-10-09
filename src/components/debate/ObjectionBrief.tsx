import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

/**
 * The brief for the revision screen: the objection, and what to do about it.
 *
 * Copy is docs/daily-path-copy.md §7 verbatim. Extracted from the revise
 * route so /styleguide/arena renders the same tree against a fixture rather
 * than a second copy of it — a preview that can drift from the screen it
 * previews is worse than no preview.
 */
export function ObjectionBrief({
  objection,
}: {
  objection: { school: SchoolId; claim: string; why_it_stands: string };
}) {
  return (
    <>
      <p className="text-sm text-ink-mid">Steps 4&ndash;5 of 6</p>
      <h1 className="mt-1 max-w-[24ch] text-xl font-extrabold leading-tight tracking-tight text-ink">
        The objection you left standing
      </h1>

      {/* Pinned, not dismissable: the objection is the brief for this
          screen, and hiding it would leave the editor contextless. The
          rival school's colour is the one tribal marker here, and it marks
          the school raising the objection, not the reader's. */}
      <div
        className="mt-6 max-w-[60ch] rounded-panel border-2 border-l-8 border-rule bg-surface p-5"
        style={{ borderLeftColor: SCHOOL_COLORS[objection.school].surface }}
      >
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          Raised by {SCHOOL_COLORS[objection.school].name}
        </p>
        <p className="mt-3 font-serif text-md leading-relaxed text-ink">{objection.claim}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-mid">{objection.why_it_stands}</p>
      </div>

      <p className="mt-6 mb-10 max-w-[60ch] text-base leading-relaxed text-ink">
        Answer it in a revision. You get one, and it does not move your rating.
      </p>
    </>
  );
}
