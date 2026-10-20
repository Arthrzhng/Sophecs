import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SchoolCard } from "../src/components/today/TodayCards";
import { PUBLISHED_SCHOOL_IDS, ALL_SCHOOL_IDS, isPublished } from "../src/lib/school-registry";
import { schoolColourVar } from "../src/lib/school-registry";
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

const DRAFTS = ALL_SCHOOL_IDS.filter((id) => !isPublished(id));

describe("the Your school card", () => {
  it.each([...PUBLISHED_SCHOOL_IDS])("renders %s in its own colour", (id) => {
    const html = render(id);
    expect(html).toContain(schoolColourVar(id));
    expect(html).not.toContain("var(--color-ink)");
  });

  it.each([...DRAFTS])("renders %s in neutral ink and names it correctly", (id) => {
    const html = render(id);
    expect(html).toContain("var(--color-ink)");
    // Never another school's token.
    for (const other of PUBLISHED_SCHOOL_IDS) {
      expect(html, `${id} borrowed ${other}'s colour`).not.toContain(schoolColourVar(other));
    }
    // And the name is the school's own, not "undefined".
    expect(html).not.toContain("undefined");
  });

  it("renders a school the registry has never heard of without borrowing a colour", () => {
    // Not a SchoolId: this is the case the old ternary chain silently
    // handled by falling through to Stoic green. A string from a database
    // row that 2C's widened constraint lets through, or from a profile
    // written by a later version of the app, arrives exactly like this.
    expect(() => render("mohism" as SchoolId)).toThrowError(/no entry for "mohism"/);
  });
});
