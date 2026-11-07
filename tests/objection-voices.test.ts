import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { PUBLISHED_SCHOOL_IDS } from "../src/lib/school-registry";
import { DRAFT_SCHOOL_IDS } from "../src/lib/school-registry.drafts";
import { OBJECTION_VOICES, objectionVoiceFor } from "../src/lib/judge/objection-voices";
import { fidelityCriteriaFor, rivalsOf } from "../src/lib/judge/rubric";
import type { SchoolId } from "../src/lib/types";

// Arthur's ruling of 2026-11-03: the v3 criteria name which rival normally
// voices each school's best-known objection, for all six schools alike,
// with a school still in draft (Ubuntu, for Confucianism) named only once
// it is published.

const ALL: SchoolId[] = [...PUBLISHED_SCHOOL_IDS, ...DRAFT_SCHOOL_IDS];
const mentions = (text: string, id: SchoolId) => text.includes(`\`${id}\``);

describe("objection voices", () => {
  it("give every school a voice among the schools a v3 prompt lists today", () => {
    for (const id of ALL) {
      expect(() => objectionVoiceFor(id, rivalsOf(id)), id).not.toThrow();
    }
  });

  it("never let a school voice the objection to itself", () => {
    for (const id of ALL) {
      for (const voice of OBJECTION_VOICES[id]) expect(voice.rival, id).not.toBe(id);
    }
  });

  it("name only rivals the prompt lists, so the reply can return them", () => {
    for (const id of ALL) {
      const sentence = objectionVoiceFor(id, rivalsOf(id));
      for (const other of ALL) {
        if (!rivalsOf(id).includes(other)) expect(mentions(sentence, other), `${id} names ${other}`).toBe(false);
      }
    }
  });

  it("carry Arthur's two voices for Confucianism in his words, Ubuntu's only once it is listed", () => {
    const today = objectionVoiceFor("confucian", rivalsOf("confucian"));
    expect(today).toContain(
      "`utilitarianism` (the subordinate party's interests go uncounted when the stronger party sets the terms)"
    );
    expect(mentions(today, "ubuntu")).toBe(false);
    const withUbuntu = objectionVoiceFor("confucian", [...rivalsOf("confucian"), "ubuntu"]);
    expect(withUbuntu).toContain("`ubuntu` (solidarity requires the weaker party can be heard)");
  });

  it("throws rather than name no voice", () => {
    expect(() => objectionVoiceFor("ubuntu", ["utilitarianism", "virtue-ethics"])).toThrow(
      /no listed rival voices the known objection to "ubuntu"/
    );
  });

  it("reach every live school's v3 criteria, and only v3's", () => {
    for (const id of PUBLISHED_SCHOOL_IDS) {
      const sentence = objectionVoiceFor(id, rivalsOf(id));
      expect(fidelityCriteriaFor(id, "v3").endsWith(`\n\n${sentence}`), id).toBe(true);
      expect(fidelityCriteriaFor(id, "v2"), id).not.toContain("normally voices this objection");
      expect(fidelityCriteriaFor(id, "v1"), id).not.toContain("normally voices this objection");
    }
  });
});

// Arthur, 2026-11-07, Gate 4 item 3: "Count the named voices; widen the
// fixtures' objection sets to match." Every golden fixture accepts each
// rival its school's criteria name as voicing the objection.
describe("the golden fixtures' objection sets", () => {
  const dir = path.join(process.cwd(), "tests/judge/golden");
  const fixtures = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { name: string; school: SchoolId; expected_objection_school: SchoolId[] });

  it("include every named voice for the fixture's school", () => {
    expect(fixtures).toHaveLength(25);
    for (const f of fixtures) {
      for (const { rival } of OBJECTION_VOICES[f.school]) expect(f.expected_objection_school, `${f.name}: ${rival}`).toContain(rival);
    }
  });
});
