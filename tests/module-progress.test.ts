import { describe, it, expect } from "vitest";
import {
  moduleProgressKey,
  progressAction,
  progressChip,
} from "../src/lib/module-progress";

describe("moduleProgressKey", () => {
  it("separates two readers on one browser, and names the signed-out one", () => {
    expect(moduleProgressKey("u1", "what-is-up-to-us")).toBe("module:u1:what-is-up-to-us");
    expect(moduleProgressKey("anon", "what-is-up-to-us")).toBe("module:anon:what-is-up-to-us");
  });
});

describe("progressChip", () => {
  it("is the three states §10 names", () => {
    expect(progressChip(0, 3)).toBe("Not started");
    expect(progressChip(2, 3)).toBe("Reading 2 of 3");
    expect(progressChip(3, 3)).toBe("Read");
  });

  it("treats a mark past the end as read, not as a count past the total", () => {
    expect(progressChip(4, 3)).toBe("Read");
  });

  it("is 'Not started' for a module with no readings rather than 'Read'", () => {
    expect(progressChip(0, 0)).toBe("Not started");
  });
});

describe("progressAction", () => {
  it("is the three labels §10 names", () => {
    expect(progressAction(0, 3)).toBe("Start");
    expect(progressAction(1, 3)).toBe("Continue");
    expect(progressAction(3, 3)).toBe("Read again");
  });

  it("agrees with the chip at every point", () => {
    const pairs: [number, string, string][] = [
      [0, "Not started", "Start"],
      [1, "Reading 1 of 3", "Continue"],
      [2, "Reading 2 of 3", "Continue"],
      [3, "Read", "Read again"],
    ];
    for (const [reached, chip, action] of pairs) {
      expect(progressChip(reached, 3)).toBe(chip);
      expect(progressAction(reached, 3)).toBe(action);
    }
  });
});
