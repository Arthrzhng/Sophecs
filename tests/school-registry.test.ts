import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import {
  ALL_SCHOOL_IDS,
  PUBLISHED_SCHOOL_IDS,
  QUIZ_SCHOOLS,
  SCHOOLS,
  isPublished,
  knownSchool,
  schoolAdherent,
  schoolAdherentPlural,
  schoolColourVar,
  schoolEntry,
  schoolShadeVar,
  totalOverSchools,
  type SchoolId,
} from "../src/lib/school-registry";
import { SCHOOL_ADHERENT, SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "../src/lib/school-colors";
import { CARD_SURFACE, CARD_SURFACE_NEUTRAL, SCHOOL_MARKER, SCHOOL_MARKER_NEUTRAL } from "../src/lib/card-tokens";
import { SCHOOL_CHUNKY } from "../src/components/daily-path/chunky";
import { FIDELITY_CRITERIA, judgeableSchools } from "../src/lib/judge/rubric";
import { VerdictSchema } from "../src/lib/judge/schema";

const SCHOOLS_DIR = path.join(process.cwd(), "content", "schools");

function contentSchools() {
  return fs
    .readdirSync(SCHOOLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => matter(fs.readFileSync(path.join(SCHOOLS_DIR, f), "utf-8")).data);
}

describe("the registry and the content files", () => {
  it("list the same schools", () => {
    const fromContent = contentSchools()
      .map((d) => d.id as string)
      .sort();
    expect([...ALL_SCHOOL_IDS].sort()).toEqual(fromContent);
  });

  it("agree on every school's name, status and colour token", () => {
    for (const data of contentSchools()) {
      const entry = schoolEntry(data.id as SchoolId);
      expect(entry.name, `name for ${entry.id}`).toBe(data.name);
      // A content file with no `status` is published; the registry says so
      // in a word rather than by omission.
      expect(entry.status, `status for ${entry.id}`).toBe(data.status ?? "published");
      expect(entry.colourToken, `colour token for ${entry.id}`).toBe(
        (data.colour_token as string | undefined) ?? null
      );
    }
  });
});

describe("the two lists", () => {
  it("keep the quiz on the original three", () => {
    expect(QUIZ_SCHOOLS).toEqual(["stoicism", "utilitarianism", "virtue-ethics"]);
  });

  it("agree that every quiz school is published", () => {
    for (const id of QUIZ_SCHOOLS) expect(isPublished(id), id).toBe(true);
  });

  it("publish exactly the three schools that were live before this branch", () => {
    expect(PUBLISHED_SCHOOL_IDS).toEqual(["stoicism", "utilitarianism", "virtue-ethics"]);
  });

  it("keep the published schools in the order the product renders them", () => {
    const order = SCHOOLS.filter((s) => s.status === "published").map((s) => s.id);
    expect(PUBLISHED_SCHOOL_IDS).toEqual(order);
  });

  it("know a draft school without publishing it", () => {
    expect(knownSchool("confucian")).toBe(true);
    expect(isPublished("confucian")).toBe(false);
    expect(PUBLISHED_SCHOOL_IDS).not.toContain("confucian");
  });

  it("do not know a string that is not a school", () => {
    expect(knownSchool("mohism")).toBe(false);
    expect(knownSchool("")).toBe(false);
  });
});

describe("what a published school must have", () => {
  // These are the gates on publishing. A school moving from draft to
  // published without them fails here rather than rendering a fallback at
  // a reader.
  it.each([...PUBLISHED_SCHOOL_IDS])("%s has an adherent noun, singular and plural", (id) => {
    const entry = schoolEntry(id);
    expect(entry.adherent, `${id} needs an adherent noun`).toBeTruthy();
    expect(entry.adherentPlural, `${id} needs a plural adherent noun`).toBeTruthy();
    // Not the fallback: the accessors return the display name where the
    // noun is missing, and "what a Stoicism would say" is the bug.
    expect(schoolAdherent(id)).not.toBe(entry.name);
    expect(schoolAdherentPlural(id)).not.toBe(entry.name);
  });

  it.each([...PUBLISHED_SCHOOL_IDS])("%s has a colour token of its own", (id) => {
    expect(schoolEntry(id).colourToken, `${id} needs a colour token`).toBeTruthy();
    expect(SCHOOL_TEXT_CLASS[id]).not.toBe("text-ink");
    expect(CARD_SURFACE[id]).not.toBe(CARD_SURFACE_NEUTRAL);
    expect(SCHOOL_MARKER[id]).not.toBe(SCHOOL_MARKER_NEUTRAL);
  });

  it.each([...PUBLISHED_SCHOOL_IDS])("%s has fidelity criteria the judge can use", (id) => {
    expect(FIDELITY_CRITERIA[id].length).toBeGreaterThan(200);
  });

  it("can judge every published school and no other", () => {
    expect(judgeableSchools()).toEqual([...PUBLISHED_SCHOOL_IDS]);
  });
});

describe("a school with nothing of its own", () => {
  // The three new schools are in the repository with no colour, no
  // adherent noun and no fidelity criteria. Everything keyed by school has
  // to answer for them without reaching for another school's values.
  const DRAFTS = ALL_SCHOOL_IDS.filter((id) => !isPublished(id));

  it("is actually in the registry to test", () => {
    expect(DRAFTS.length).toBeGreaterThan(0);
  });

  it.each([...ALL_SCHOOL_IDS.filter((id) => !isPublished(id))])(
    "%s renders in neutral ink, never another school's colour",
    (id) => {
      const otherColours = PUBLISHED_SCHOOL_IDS.flatMap((other) => [
        CARD_SURFACE[other],
        SCHOOL_MARKER[other],
        SCHOOL_TEXT_CLASS[other],
        schoolColourVar(other),
        schoolShadeVar(other),
        SCHOOL_CHUNKY[other].bg,
        SCHOOL_CHUNKY[other].shade,
      ]);

      expect(schoolColourVar(id)).toBe("var(--color-ink)");
      expect(schoolShadeVar(id)).toBe("var(--color-ink)");
      expect(SCHOOL_TEXT_CLASS[id]).toBe("text-ink");
      expect(CARD_SURFACE[id]).toBe(CARD_SURFACE_NEUTRAL);
      expect(SCHOOL_MARKER[id]).toBe(SCHOOL_MARKER_NEUTRAL);

      for (const value of [
        schoolColourVar(id),
        schoolShadeVar(id),
        SCHOOL_TEXT_CLASS[id],
        CARD_SURFACE[id],
        SCHOOL_MARKER[id],
        SCHOOL_CHUNKY[id].bg,
        SCHOOL_CHUNKY[id].shade,
      ]) {
        expect(otherColours, `${id} borrowed ${value}`).not.toContain(value);
      }
    }
  );

  it("still has a name and a card entry rather than undefined", () => {
    for (const id of DRAFTS) {
      expect(SCHOOL_COLORS[id].name).toBeTruthy();
      expect(SCHOOL_COLORS[id].name).not.toBe("undefined");
      expect(SCHOOL_ADHERENT[id]).toBeTruthy();
    }
  });

  it("cannot be judged, and says so rather than judging against nothing", () => {
    for (const id of DRAFTS) {
      expect(() => FIDELITY_CRITERIA[id]).toThrowError(/no fidelity criteria/);
    }
  });

  it("is not a school a verdict may name", () => {
    const verdict = (school: string) => ({
      rejected: false,
      score: 70,
      fidelity: 7,
      rigor: 7,
      engagement: 7,
      strongest_move: "a",
      weakest_move: "b",
      a_stronger_version_would: "c",
      verdict_line: "d",
      unanswered_objection: { school, claim: "e", why_it_stands: "f" },
    });
    for (const id of PUBLISHED_SCHOOL_IDS) {
      expect(VerdictSchema.safeParse(verdict(id)).success, id).toBe(true);
    }
    for (const id of DRAFTS) {
      expect(VerdictSchema.safeParse(verdict(id)).success, id).toBe(false);
    }
  });
});

describe("totalOverSchools", () => {
  it("fills every school and keeps the entries it was given", () => {
    const total = totalOverSchools({ stoicism: "kept" }, "neutral");
    expect(Object.keys(total).sort()).toEqual([...ALL_SCHOOL_IDS].sort());
    expect(total.stoicism).toBe("kept");
    for (const id of ALL_SCHOOL_IDS) {
      if (id !== "stoicism") expect(total[id]).toBe("neutral");
    }
  });
});

describe("the surfaces that must not move", () => {
  // Design tokens, the result card and the OG images are frozen. The
  // registry now derives the lists these render from, so these pin the
  // output: same colours, same order, or the test says so rather than a
  // deploy doing it quietly.
  it("keeps the landing card's hairline at the same three colours in the same order", () => {
    expect(PUBLISHED_SCHOOL_IDS.map((id) => SCHOOL_MARKER[id])).toEqual([
      "#3e5c4b",
      "#8a6320",
      "#7a3540",
    ]);
  });

  it("keeps the three card surfaces exactly as they were", () => {
    expect(PUBLISHED_SCHOOL_IDS.map((id) => CARD_SURFACE[id])).toEqual([
      "#33503f",
      "#7a5518",
      "#6b2c37",
    ]);
  });

  it("keeps the three Tailwind text classes, which the scanner needs as literals", () => {
    expect(PUBLISHED_SCHOOL_IDS.map((id) => SCHOOL_TEXT_CLASS[id])).toEqual([
      "text-stoic",
      "text-utilitarian",
      "text-virtue",
    ]);
  });

  it("keeps the chunky control fills reading from the school tokens", () => {
    expect(PUBLISHED_SCHOOL_IDS.map((id) => SCHOOL_CHUNKY[id])).toEqual([
      { bg: "var(--color-stoic)", shade: "var(--color-stoic-deep)" },
      { bg: "var(--color-utilitarian)", shade: "var(--color-utilitarian-deep)" },
      { bg: "var(--color-virtue)", shade: "var(--color-virtue-deep)" },
    ]);
  });

  it("keeps the display names and adherent nouns word for word", () => {
    expect(PUBLISHED_SCHOOL_IDS.map((id) => SCHOOL_COLORS[id].name)).toEqual([
      "Stoicism",
      "Utilitarianism",
      "Virtue Ethics",
    ]);
    expect(PUBLISHED_SCHOOL_IDS.map((id) => SCHOOL_ADHERENT[id])).toEqual([
      "Stoic",
      "Utilitarian",
      "Virtue Ethicist",
    ]);
  });
});
