import { describe, it, expect } from "vitest";
import { seedDiff, SEEDED_FIELDS, type TopicRow } from "../src/lib/topic-seed-diff";
import type { TopicFile } from "../src/lib/topics";

const topic: TopicFile = {
  slug: "x",
  title: "X",
  motion: "The new motion.",
  stances: { stoicism: "s", utilitarianism: "u", "virtue-ethics": "v" },
  micro_before: "x-before",
  micro_after: "x-after",
  sort: 1,
  active: true,
};

const row: TopicRow = {
  slug: "x",
  title: "X",
  motion: "The old motion.",
  stances: { stoicism: "s", utilitarianism: "u", "virtue-ethics": "v" },
  micro_before: "x-before",
  micro_after: "x-after",
  sort: 1,
  active: true,
};

describe("seedDiff", () => {
  it("reports only the fields that differ", () => {
    const diff = seedDiff([topic], [row]);
    expect(diff.topics).toHaveLength(1);
    expect(diff.topics[0].kind).toBe("update");
    expect(diff.topics[0].changes).toEqual([
      { field: "motion", before: "The old motion.", after: "The new motion." },
    ]);
  });

  it("calls an identical row unchanged", () => {
    const diff = seedDiff([topic], [{ ...row, motion: topic.motion }]);
    expect(diff.topics[0].kind).toBe("unchanged");
    expect(diff.topics[0].changes).toEqual([]);
  });

  // Postgres gives the object back with its keys in its own order, which a
  // naive JSON.stringify comparison would report as a change on every run.
  it("does not mistake key order in stances for a change", () => {
    const reordered = {
      ...row,
      motion: topic.motion,
      stances: { "virtue-ethics": "v", stoicism: "s", utilitarianism: "u" },
    };
    expect(seedDiff([topic], [reordered]).topics[0].kind).toBe("unchanged");
  });

  it("treats a slug with no row as an insert of every seeded field", () => {
    const diff = seedDiff([topic], []);
    expect(diff.topics[0].kind).toBe("insert");
    expect(diff.topics[0].changes.map((c) => c.field)).toEqual([...SEEDED_FIELDS]);
    expect(diff.topics[0].changes.every((c) => c.before === undefined)).toBe(true);
  });

  it("names rows no file claims, and does not propose deleting them", () => {
    const diff = seedDiff([topic], [row, { slug: "retired" }]);
    expect(diff.orphanedSlugs).toEqual(["retired"]);
    expect(diff.topics.map((t) => t.slug)).toEqual(["x"]);
  });

  // The reason the seeder leaves them out: /api/judge writes them as real
  // debates happen, and a content edit must never reset them.
  it("leaves par_elo and par_n out of the comparison entirely", () => {
    expect(SEEDED_FIELDS).not.toContain("par_elo");
    expect(SEEDED_FIELDS).not.toContain("par_n");
    const withPar = { ...row, motion: topic.motion, par_elo: "1400", par_n: 9 } as TopicRow;
    expect(seedDiff([topic], [withPar]).topics[0].kind).toBe("unchanged");
  });
});
