import { describe, it, expect } from "vitest";
import { chartScale, isoWeekYear, ratingByWeek } from "../src/lib/rating-history";

describe("isoWeekYear", () => {
  it("puts 1 January in the previous year when its week belongs there", () => {
    // 2027-01-01 is a Friday, in week 53 of 2026.
    expect(isoWeekYear(new Date("2027-01-01T12:00:00Z"))).toBe(2026);
  });

  it("is the calendar year in the middle of one", () => {
    expect(isoWeekYear(new Date("2026-06-15T12:00:00Z"))).toBe(2026);
  });
});

describe("ratingByWeek", () => {
  it("keeps the last rating of each week", () => {
    const points = ratingByWeek([
      { created_at: "2026-10-05T09:00:00Z", elo_after: 1210 },
      { created_at: "2026-10-08T09:00:00Z", elo_after: 1225 },
    ]);
    expect(points).toEqual([{ year: 2026, week: 41, rating: 1225 }]);
  });

  it("returns one point per week, oldest first, whatever order the rows arrive in", () => {
    const points = ratingByWeek([
      { created_at: "2026-10-15T09:00:00Z", elo_after: 1240 },
      { created_at: "2026-10-06T09:00:00Z", elo_after: 1210 },
    ]);
    expect(points.map((p) => p.week)).toEqual([41, 42]);
    expect(points.map((p) => p.rating)).toEqual([1210, 1240]);
  });

  it("orders across a year boundary by the ISO week-year, not the calendar one", () => {
    const points = ratingByWeek([
      { created_at: "2027-01-01T09:00:00Z", elo_after: 1300 },
      { created_at: "2026-12-21T09:00:00Z", elo_after: 1280 },
    ]);
    expect(points.map((p) => [p.year, p.week])).toEqual([
      [2026, 52],
      [2026, 53],
    ]);
  });

  it("skips a row with no rating rather than plotting a gap", () => {
    expect(
      ratingByWeek([
        { created_at: "2026-10-05T09:00:00Z", elo_after: null },
        { created_at: "2026-10-06T09:00:00Z", elo_after: 1210 },
      ])
    ).toEqual([{ year: 2026, week: 41, rating: 1210 }]);
  });

  it("is empty for no rows", () => {
    expect(ratingByWeek([])).toEqual([]);
  });
});

describe("chartScale", () => {
  it("puts round numbers on the axis", () => {
    const { ticks } = chartScale([1203, 1247]);
    expect(ticks.every((t) => t % 10 === 0)).toBe(true);
  });

  it("holds a minimum span open so a two-point move is not drawn as fifty", () => {
    const { min, max } = chartScale([1200, 1202]);
    expect(max - min).toBeGreaterThanOrEqual(40);
  });

  it("contains every value it was given", () => {
    const values = [1188, 1204, 1251];
    const { min, max } = chartScale(values);
    expect(min).toBeLessThanOrEqual(Math.min(...values));
    expect(max).toBeGreaterThanOrEqual(Math.max(...values));
  });

  it("keeps a single value off the floor and the ceiling", () => {
    const { min, max } = chartScale([1200]);
    expect(min).toBeLessThan(1200);
    expect(max).toBeGreaterThan(1200);
  });
});
