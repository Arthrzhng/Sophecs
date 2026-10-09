import { describe, it, expect } from "vitest";
import { checkKey, isCheckComplete } from "../src/lib/reading-check-progress";

describe("checkKey", () => {
  it("separates two readers on one browser", () => {
    expect(checkKey("u1", "opaque-benefit")).toBe("check:u1:opaque-benefit");
    expect(checkKey("u2", "opaque-benefit")).toBe("check:u2:opaque-benefit");
  });
});

// This is the gate on whether anything is stored at all. The lesson player
// writes picks only when it returns true, so that leaving the overlay by the
// X or by Escape part-way through records nothing (docs/daily-path-copy.md
// §2). Every case below is a check the reader did not finish.
describe("isCheckComplete", () => {
  it("is true only once both questions have a pick", () => {
    expect(isCheckComplete([0, 2])).toBe(true);
    expect(isCheckComplete([0, 0])).toBe(true);
  });

  it("is false for a check left after the first question", () => {
    expect(isCheckComplete([1])).toBe(false);
  });

  it("is false for a check nobody has started", () => {
    expect(isCheckComplete([])).toBe(false);
  });

  it("is false when a pick is missing rather than merely zero", () => {
    // Option 0 is a real answer, so the second question's gap has to be the
    // thing that fails this, not the first question's falsy index.
    expect(isCheckComplete([0, undefined])).toBe(false);
    expect(isCheckComplete([undefined, 0])).toBe(false);
  });

  it("ignores anything past the second question", () => {
    expect(isCheckComplete([0, 1, 2])).toBe(true);
  });
});
