import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadClosings, loadFragments, buildBank, serialiseBank, bankPath, rivalIntro, BANK_SCHOOLS, LAUNCH_SCHOOLS, SCHOOLS, TOPICS, wordCount, type SchoolId } from "../../scripts/seed/banks";
import { OBJECTION_VOICES } from "../../src/lib/judge/objection-voices";

describe("argument banks", () => {
  it("are exactly what the passages build (rerun npm run seed:banks after editing one)", () => {
    const closings = loadClosings();
    for (const topic of TOPICS)
      for (const id of BANK_SCHOOLS) {
        const school = id as SchoolId;
        expect(readFileSync(bankPath(topic, school), "utf8"), `${topic}.${school}`).toBe(
          serialiseBank(buildBank(loadFragments(topic), closings, school))
        );
      }
  });

  it("hold forty arguments each, 10 strong, 20 mid, 10 weak, 80 to 250 words, all different", () => {
    expect(BANK_SCHOOLS).toHaveLength(6);
    for (const topic of TOPICS)
      for (const id of BANK_SCHOOLS) {
        const bank = JSON.parse(readFileSync(bankPath(topic, id as SchoolId), "utf8")) as { tier: string; text: string }[];
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

  // Arthur, 2026-11-07, Gate 4 item 13: banks for the three new schools at
  // the same depth as the live three's. Two objections each, as the live
  // three have, from two rivals: always the rivals the school's criteria
  // name as voicing its best-known objection.
  it("give each launch school two objections, from two rivals, its named voices among them", () => {
    for (const topic of TOPICS)
      for (const school of LAUNCH_SCHOOLS) {
        const rivals = loadFragments(topic).schools[school as unknown as SchoolId].objections.map((o) => o.rival as string);
        expect(rivals, `${topic}.${school}`).toHaveLength(2);
        expect(new Set(rivals).size).toBe(2);
        expect(rivals).not.toContain(school);
        for (const { rival } of OBJECTION_VOICES[school]) expect(rivals, `${topic}.${school}`).toContain(rival);
      }
  });

  it("introduce a rival with its own article on any build, so the new banks read the same wherever they are written", () => {
    expect(rivalIntro("stoicism")).toBe("A Stoic");
    expect(rivalIntro("ubuntu" as unknown as SchoolId)).toBe("An Ubuntu Ethicist");
    expect(rivalIntro("confucian" as unknown as SchoolId)).toBe("A Confucian");
    const ubuntuNamed = JSON.parse(readFileSync(bankPath("opaque-benefit", "confucian" as unknown as SchoolId), "utf8")) as { text: string }[];
    expect(ubuntuNamed.some((a) => a.text.includes("An Ubuntu Ethicist will object that"))).toBe(true);
    expect(ubuntuNamed.some((a) => a.text.includes("A Ubuntu"))).toBe(false);
  });

  it("leave the run's own schools as they were: the generator still reads the quiz's three", () => {
    expect(LAUNCH_SCHOOLS).toHaveLength(3);
    expect([...SCHOOLS]).toEqual(["stoicism", "utilitarianism", "virtue-ethics"]);
    expect(BANK_SCHOOLS.slice(0, 3)).toEqual(SCHOOLS);
  });

  it("count words from the passages exactly as composing and counting would", async () => {
    const { allCompositions } = await import("../../scripts/seed/compositions");
    const { loadBanks, compose, partsWords, wordCount, TOPICS, BANK_SCHOOLS } = await import("../../scripts/seed/banks");
    const banks = loadBanks();
    let checked = 0;
    for (const topic of TOPICS)
      for (const id of BANK_SCHOOLS)
        for (const tier of ["strong", "mid", "weak"] as const) {
          const school = id as SchoolId;
          const all = allCompositions(banks, topic, school, tier);
          for (let i = 0; i < all.length; i += 97) {
            const p = all[i];
            expect(partsWords(banks.fragments[topic], banks.closings, school, p)).toBe(wordCount(compose(banks.fragments[topic], banks.closings, school, p)));
            checked++;
          }
          // And no two compositions in a list make the same text.
          const texts = all.map((p) => compose(banks.fragments[topic], banks.closings, school, p));
          expect(new Set(texts).size).toBe(texts.length);
        }
    expect(checked).toBeGreaterThan(2000);
  });
});

