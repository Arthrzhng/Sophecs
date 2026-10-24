import { describe, it, expect } from "vitest";
import { fillPlaceholders } from "../src/lib/judge/fill-placeholder";

// A reviewer's finding: the guard that refuses a prompt naming a
// placeholder twice had no test of its own, so it could be reverted to a
// silent `replace` and the whole suite would stay green. These make the
// three throwing paths and the two substitution hazards fail loudly.

const RUBRIC = { value: "CRITERIA", required: true };
const RIVALS = { value: "- `stoicism`", required: false };

describe("fillPlaceholders", () => {
  it("fills a placeholder that appears exactly once", () => {
    expect(fillPlaceholders("before {{RUBRIC}} after", { "{{RUBRIC}}": RUBRIC })).toBe(
      "before CRITERIA after"
    );
  });

  it("leaves an absent optional placeholder alone, changing nothing", () => {
    // This is what keeps the v2 request byte-identical: judge.v2.md has no
    // {{RIVAL_SCHOOLS}}, so the substitution must be a no-op there.
    const template = "a prompt with no rival list in it";
    expect(fillPlaceholders(template, { "{{RIVAL_SCHOOLS}}": RIVALS })).toBe(template);
  });

  it("throws when a required placeholder is missing", () => {
    expect(() => fillPlaceholders("no rubric here", { "{{RUBRIC}}": RUBRIC })).toThrow(
      "judge prompt is missing {{RUBRIC}}"
    );
  });

  it("throws when a placeholder appears twice", () => {
    // The real regression: judge.v3.md named {{RUBRIC}} in its own header
    // comment and again as the placeholder. The whole file is sent to the
    // model, so the naive fill filled the comment and left the placeholder.
    const template = "<!-- interpolated at {{RUBRIC}} -->\n\n{{RUBRIC}}";
    expect(() => fillPlaceholders(template, { "{{RUBRIC}}": RUBRIC })).toThrow(
      "judge prompt names {{RUBRIC}} 2 times; it must appear at most once"
    );
  });

  it("throws when a placeholder appears three times", () => {
    expect(() =>
      fillPlaceholders("{{RUBRIC}} {{RUBRIC}} {{RUBRIC}}", { "{{RUBRIC}}": RUBRIC })
    ).toThrow("names {{RUBRIC}} 3 times");
  });

  it("counts an occurrence inside an HTML comment, because the model reads it", () => {
    expect(() =>
      fillPlaceholders("<!-- {{RUBRIC}} -->", { "{{RUBRIC}}": RUBRIC })
    ).not.toThrow();
    expect(fillPlaceholders("<!-- {{RUBRIC}} -->", { "{{RUBRIC}}": RUBRIC })).toBe(
      "<!-- CRITERIA -->"
    );
  });

  it("never re-reads what it substituted", () => {
    // Criteria are content somebody writes. One that contained another
    // placeholder used to have that placeholder filled in turn, because
    // the fills ran one after another over the growing string.
    const out = fillPlaceholders("{{RUBRIC}}", {
      "{{RUBRIC}}": { value: "criteria mentioning {{RIVAL_SCHOOLS}} verbatim", required: true },
      "{{RIVAL_SCHOOLS}}": RIVALS,
    });
    expect(out).toBe("criteria mentioning {{RIVAL_SCHOOLS}} verbatim");
    expect(out).not.toContain("stoicism");
  });

  it("treats a dollar sequence in a value as text, not as a replacement pattern", () => {
    // `replace(needle, value)` would read $& as "the whole match".
    const out = fillPlaceholders("{{RUBRIC}}", {
      "{{RUBRIC}}": { value: "costs $& and $1 and $$", required: true },
    });
    expect(out).toBe("costs $& and $1 and $$");
  });

  it("fills two different placeholders in the same pass", () => {
    expect(
      fillPlaceholders("{{RUBRIC}}\n\n{{RIVAL_SCHOOLS}}", {
        "{{RUBRIC}}": RUBRIC,
        "{{RIVAL_SCHOOLS}}": RIVALS,
      })
    ).toBe("CRITERIA\n\n- `stoicism`");
  });
});
