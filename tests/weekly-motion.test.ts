import { describe, it, expect } from "vitest";
import { getWeeklyMotion, isoWeekNumber } from "../src/lib/weekly-motion";

const TOPICS = [
  { slug: "a", title: "A", sort: 1 },
  { slug: "b", title: "B", sort: 2 },
  { slug: "c", title: "C", sort: 3 },
  { slug: "d", title: "D", sort: 4 },
  { slug: "e", title: "E", sort: 5 },
  { slug: "f", title: "F", sort: 6 },
];

describe("isoWeekNumber", () => {
  it("numbers weeks by the year containing their Thursday", () => {
    // 2027-01-01 is a Friday, so it belongs to week 53 of 2026 — the case a
    // naive day-of-year division gets wrong.
    expect(isoWeekNumber(new Date("2027-01-01T00:00:00Z"))).toBe(53);
    // 2027-01-04 is the Monday of ISO week 1.
    expect(isoWeekNumber(new Date("2027-01-04T00:00:00Z"))).toBe(1);
  });

  it("holds a single number across a whole week", () => {
    const monday = isoWeekNumber(new Date("2026-09-14T00:00:00Z"));
    for (const day of ["15", "16", "17", "18", "19", "20"]) {
      expect(isoWeekNumber(new Date(`2026-09-${day}T12:00:00Z`))).toBe(monday);
    }
    // ...and ticks over on the next Monday.
    expect(isoWeekNumber(new Date("2026-09-21T00:00:00Z"))).toBe(monday + 1);
  });
});

describe("getWeeklyMotion", () => {
  it("returns null when there are no active topics", () => {
    expect(getWeeklyMotion([], new Date("2026-09-16T00:00:00Z"))).toBeNull();
  });

  it("is stable within a week and rotates on the next", () => {
    const wed = getWeeklyMotion(TOPICS, new Date("2026-09-16T00:00:00Z"));
    const sun = getWeeklyMotion(TOPICS, new Date("2026-09-20T23:59:00Z"));
    const nextMon = getWeeklyMotion(TOPICS, new Date("2026-09-21T00:00:00Z"));
    expect(wed).toEqual(sun);
    expect(nextMon).not.toEqual(wed);
  });

  it("keeps rotating across a year boundary rather than resetting", () => {
    const wk52 = getWeeklyMotion(TOPICS, new Date("2026-12-24T00:00:00Z"));
    const wk53 = getWeeklyMotion(TOPICS, new Date("2026-12-31T00:00:00Z"));
    const wk1 = getWeeklyMotion(TOPICS, new Date("2027-01-04T00:00:00Z"));
    expect(wk52).not.toEqual(wk53);
    expect(wk53).not.toEqual(wk1);
  });

  it("orders by sort, not by array order", () => {
    const shuffled = [...TOPICS].reverse();
    const date = new Date("2026-09-16T00:00:00Z");
    expect(getWeeklyMotion(shuffled, date)).toEqual(getWeeklyMotion(TOPICS, date));
  });
});
