import { describe, it, expect } from "vitest";
import { getAllTopicFiles } from "../src/lib/topics";
import { PUBLISHED_SCHOOL_IDS } from "../src/lib/school-registry";

/**
 * Every published topic carries a stance line for every published school.
 *
 * `TopicFile.stances` is sparse over `SchoolId` now, because a topic
 * written before a school existed has no line for it. That is the right
 * type and the wrong thing to ship: /debate prints "Your stance: …" from
 * it, and a reader whose school has no line would get the heading and
 * nothing after it. The component skips the line when it is missing, and
 * this makes sure a reader never reaches that branch.
 */
describe("topic stances", () => {
  const topics = getAllTopicFiles();

  it("has topics to check", () => {
    expect(topics.length).toBeGreaterThan(0);
  });

  it.each(getAllTopicFiles().map((t) => t.slug))(
    "%s has a stance for every published school",
    (slug) => {
      const topic = topics.find((t) => t.slug === slug);
      expect(topic).toBeDefined();
      for (const school of PUBLISHED_SCHOOL_IDS) {
        const stance = topic?.stances[school];
        expect(stance, `${slug} has no stance for ${school}`).toBeTruthy();
        expect(String(stance).trim().length).toBeGreaterThan(20);
      }
    }
  );
});
