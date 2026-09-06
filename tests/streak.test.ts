import { describe, expect, it } from "vitest";
import { applyStreakDay, isStreakEligible, STREAK_THRESHOLD } from "../src/lib/streak";

describe("isStreakEligible", () => {
  it("requires a score of at least 40", () => {
    expect(isStreakEligible(40)).toBe(true);
    expect(isStreakEligible(39)).toBe(false);
    expect(isStreakEligible(100)).toBe(true);
    expect(isStreakEligible(0)).toBe(false);
  });

  it("matches the exported threshold", () => {
    expect(STREAK_THRESHOLD).toBe(40);
  });
});

describe("applyStreakDay", () => {
  it("starts a streak at 1 on the first-ever qualifying day", () => {
    const result = applyStreakDay({ streak: 0, streakUpdatedOn: null }, "2026-01-01");
    expect(result).toEqual({ streak: 1, streakUpdatedOn: "2026-01-01", change: "extended" });
  });

  it("extends the streak on a consecutive day", () => {
    const result = applyStreakDay({ streak: 3, streakUpdatedOn: "2026-01-01" }, "2026-01-02");
    expect(result).toEqual({ streak: 4, streakUpdatedOn: "2026-01-02", change: "extended" });
  });

  it("does not double-count a second qualifying debate on the same day", () => {
    const result = applyStreakDay({ streak: 4, streakUpdatedOn: "2026-01-02" }, "2026-01-02");
    expect(result).toEqual({ streak: 4, streakUpdatedOn: "2026-01-02", change: "unchanged" });
  });

  it("resets to 1 after a gap of more than one day", () => {
    const result = applyStreakDay({ streak: 4, streakUpdatedOn: "2026-01-02" }, "2026-01-05");
    expect(result).toEqual({ streak: 1, streakUpdatedOn: "2026-01-05", change: "reset" });
  });

  it("extends across a month boundary", () => {
    const result = applyStreakDay({ streak: 10, streakUpdatedOn: "2026-01-31" }, "2026-02-01");
    expect(result).toEqual({ streak: 11, streakUpdatedOn: "2026-02-01", change: "extended" });
  });
});
