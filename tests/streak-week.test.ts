import { describe, it, expect } from "vitest";
import { streakDayLabel, streakWeek } from "../src/lib/streak-week";

// 2026-10-07 is a Wednesday. 2026-10-05 is the Monday of its ISO week and
// 2026-10-11 the Sunday, which is the span every case below is read against.
const WEDNESDAY = "2026-10-07";

function lit(streak: number, updatedOn: string | null, today = WEDNESDAY): string {
  return streakWeek(streak, updatedOn, today)
    .map((d) => (d.lit ? d.label.toUpperCase() : "."))
    .join("");
}

describe("streakWeek", () => {
  it("is Monday to Sunday of the ISO week containing the day given", () => {
    const week = streakWeek(0, null, WEDNESDAY);
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week.map((d) => d.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(week[0].weekday).toBe("Monday");
    expect(week[6].weekday).toBe("Sunday");
  });

  it("lights the run back from the day it was last extended", () => {
    // Three days ending today: Monday, Tuesday, Wednesday.
    expect(lit(3, WEDNESDAY)).toBe("MTW....");
  });

  it("lights a run that was extended yesterday", () => {
    expect(lit(2, "2026-10-06")).toBe("MT.....");
  });

  it("lights nothing for a streak nobody has started", () => {
    expect(lit(0, null)).toBe(".......");
  });

  // The count is written at judge time and nothing clears it when a day is
  // missed, so a stale number is the normal state of a lapsed streak.
  it("lights nothing for a run that ended before yesterday", () => {
    expect(lit(4, "2026-10-05")).toBe(".......");
  });

  it("lights nothing for a date in the future", () => {
    expect(lit(3, "2026-10-09")).toBe(".......");
  });

  // Monday, with the run ending on Sunday night. The streak is live, but
  // none of it happened this week.
  it("shows an empty week on the Monday after a run that is still live", () => {
    expect(lit(5, "2026-10-04", "2026-10-05")).toBe(".......");
  });

  it("carries a run across the week boundary without lighting last week", () => {
    // Six days ending Tuesday: last Thursday through this Tuesday.
    expect(lit(6, "2026-10-06", "2026-10-06")).toBe("MT.....");
  });

  it("fills the week for a run of seven or more", () => {
    expect(lit(7, "2026-10-11", "2026-10-11")).toBe("MTWTFSS");
    expect(lit(400, "2026-10-11", "2026-10-11")).toBe("MTWTFSS");
  });

  it("treats an unparseable date as no streak rather than throwing", () => {
    expect(lit(3, "not-a-date")).toBe(".......");
  });

  it("ignores a count with no day attached", () => {
    expect(lit(3, null)).toBe(".......");
  });
});

describe("streakDayLabel", () => {
  it("names the weekday, and says so when it is a streak day", () => {
    const week = streakWeek(3, WEDNESDAY, WEDNESDAY);
    expect(streakDayLabel(week[0])).toBe("Monday, streak day");
    expect(streakDayLabel(week[3])).toBe("Thursday");
  });
});
