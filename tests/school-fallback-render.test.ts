import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SchoolCard } from "../src/components/today/TodayCards";
import { PUBLISHED_SCHOOL_IDS, schoolColourVar } from "../src/lib/school-registry";
import { DRAFT_SCHOOL_IDS } from "../src/lib/school-registry.drafts";
import type { SchoolId } from "../src/lib/types";

/**
 * The /today "Your school" card, rendered.
 *
 * This card is why the fallback rule exists. Its colour used to come from
 * a ternary chain whose last branch was the Stoic token, so a school the
 * chain did not name rendered the reader's school name in another school's
 * green: not a missing colour, a wrong one, and nothing in the suite could
 * see it. Rendered here with react-dom/server rather than through a
 * browser, because the component has no hooks and no client boundary and
 * the markup is the whole claim.
 */

function render(school: SchoolId) {
  return renderToStaticMarkup(
    createElement(SchoolCard, {
      school,
      oneLine: "A line about the school.",
      elo: 1200,
      rank: 1,
    })
  );
}

// The drafts, plus a string that is not a school at all: both arrive at
// the card the same way, as an id the client registry does not hold.
const UNKNOWN: SchoolId[] = [...DRAFT_SCHOOL_IDS, "mohism" as SchoolId];

describe("the Your school card", () => {
  it.each([...PUBLISHED_SCHOOL_IDS])("renders %s in its own colour", (id) => {
    const html = render(id);
    expect(html).toContain(schoolColourVar(id));
    expect(html).not.toContain("var(--color-ink)");
  });

  it.each(UNKNOWN)("renders %s in neutral ink, never another school's colour", (id) => {
    const html = render(id);
    expect(html).toContain("var(--color-ink)");
    for (const other of PUBLISHED_SCHOOL_IDS) {
      expect(html, `${id} borrowed ${other}'s colour`).not.toContain(schoolColourVar(other));
    }
    // The name falls back to the id, which is true and is not the string
    // "undefined". A draft school's real name is server-side only.
    expect(html).toContain(id);
    expect(html).not.toContain("undefined");
  });
});
