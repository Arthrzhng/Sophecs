import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadClosings, loadFragments, buildBank, serialiseBank, bankPath, SCHOOLS, TOPICS, wordCount } from "../../scripts/seed/banks";

describe("argument banks", () => {
  it("are exactly what the passages build (rerun npm run seed:banks after editing one)", () => {
    const closings = loadClosings();
    for (const topic of TOPICS)
      for (const school of SCHOOLS)
        expect(readFileSync(bankPath(topic, school), "utf8"), `${topic}.${school}`).toBe(
          serialiseBank(buildBank(loadFragments(topic), closings, school))
        );
  });

  it("hold forty arguments each, 10 strong, 20 mid, 10 weak, 80 to 250 words, all different", () => {
    for (const topic of TOPICS)
      for (const school of SCHOOLS) {
        const bank = JSON.parse(readFileSync(bankPath(topic, school), "utf8")) as { tier: string; text: string }[];
        expect(bank).toHaveLength(40);
        expect(bank.filter((a) => a.tier === "strong")).toHaveLength(10);
        expect(bank.filter((a) => a.tier === "mid")).toHaveLength(20);
        expect(bank.filter((a) => a.tier === "weak")).toHaveLength(10);
        expect(new Set(bank.map((a) => a.text)).size).toBe(40);
        for (const a of bank) {
          expect(wordCount(a.text)).toBeGreaterThanOrEqual(80);
          expect(wordCount(a.text)).toBeLessThanOrEqual(250);
        }
      }
  });

  it("name each objection by a rival school, one per rival", () => {
    for (const topic of TOPICS)
      for (const school of SCHOOLS) {
        const rivals = loadFragments(topic).schools[school].objections.map((o) => o.rival).sort();
        expect(rivals).toEqual(SCHOOLS.filter((s) => s !== school).sort());
      }
  });
});
