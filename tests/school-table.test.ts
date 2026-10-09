import { describe, it, expect } from "vitest";
import {
  isoWeekRange,
  joinedLeftLabel,
  rankSchools,
  schoolChanges,
  yourTableLine,
  type JudgedArgument,
  type SchoolChange,
} from "../src/lib/school-table";
import { SCHOOL_IDS } from "../src/lib/types";

const NONE = Object.fromEntries(
  SCHOOL_IDS.map((s) => [s, { joined: 0, left: 0 }])
) as Record<(typeof SCHOOL_IDS)[number], { joined: number; left: number }>;

describe("isoWeekRange", () => {
  it("opens on Monday 00:00 UTC and runs to the next Monday", () => {
    // 2026-10-09 is a Friday; its ISO week opens Monday the 5th.
    const { start, end } = isoWeekRange(new Date("2026-10-09T13:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("treats Sunday as the last day of its week, not the first of the next", () => {
    const { start } = isoWeekRange(new Date("2026-10-11T23:59:00Z"));
    expect(start.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("schoolChanges", () => {
  const start = new Date("2026-10-05T00:00:00Z");
  const end = new Date("2026-10-12T00:00:00Z");

  it("counts one retake as a leave and a join", () => {
    const entries: SchoolChange[] = [
      { from: "stoicism", to: "utilitarianism", at: "2026-10-07T10:00:00Z" },
    ];
    const counts = schoolChanges(entries, start, end);
    expect(counts.stoicism).toEqual({ joined: 0, left: 1 });
    expect(counts.utilitarianism).toEqual({ joined: 1, left: 0 });
  });

  it("counts a first quiz as a join only", () => {
    const counts = schoolChanges(
      [{ from: null, to: "virtue-ethics", at: "2026-10-07T10:00:00Z" }],
      start,
      end
    );
    expect(counts["virtue-ethics"]).toEqual({ joined: 1, left: 0 });
  });

  it("ignores changes outside the week, including the exact closing instant", () => {
    const outside: SchoolChange[] = [
      { from: "stoicism", to: "utilitarianism", at: "2026-10-04T23:59:59Z" },
      { from: "stoicism", to: "utilitarianism", at: "2026-10-12T00:00:00Z" },
      { from: "stoicism", to: "utilitarianism", at: "not a date" },
    ];
    expect(schoolChanges(outside, start, end)).toEqual(NONE);
  });
});

describe("rankSchools", () => {
  const judged = (school: string, ...marks: (number | null)[]): JudgedArgument[] =>
    marks.map((fidelity) => ({ school: school as JudgedArgument["school"], fidelity }));

  it("ranks by average fidelity, then by argument count", () => {
    const rows = rankSchools(
      [
        ...judged("stoicism", 6, 6),
        ...judged("utilitarianism", 9),
        ...judged("virtue-ethics", 6, 6, 6),
      ],
      NONE
    );
    expect(rows.map((r) => [r.school, r.rank])).toEqual([
      ["utilitarianism", 1],
      ["virtue-ethics", 2],
      ["stoicism", 3],
    ]);
  });

  it("gives tied schools the same rank, and none at all to a school with no average", () => {
    const rows = rankSchools([...judged("stoicism", 7), ...judged("utilitarianism", 7)], NONE);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, null]);
    expect(rows[2].avgFidelity).toBeNull();
  });

  it("ranks nothing at all in a week with nothing judged", () => {
    expect(rankSchools([], NONE).map((r) => r.rank)).toEqual([null, null, null]);
  });

  it("sorts a school with no judged argument last, below a zero average", () => {
    const rows = rankSchools(judged("stoicism", 0), NONE);
    expect(rows[0].school).toBe("stoicism");
    expect(rows[0].avgFidelity).toBe(0);
    expect(rows.slice(1).every((r) => r.avgFidelity === null)).toBe(true);
  });

  it("counts an argument the judge gave no fidelity mark, but leaves it out of the average", () => {
    const rows = rankSchools(judged("stoicism", 8, null), NONE);
    const stoic = rows.find((r) => r.school === "stoicism")!;
    expect(stoic.arguments).toBe(2);
    expect(stoic.avgFidelity).toBe(8);
  });

  it("carries the joined and left counts through", () => {
    const rows = rankSchools([], { ...NONE, stoicism: { joined: 2, left: 1 } });
    const stoic = rows.find((r) => r.school === "stoicism")!;
    expect([stoic.joined, stoic.left]).toEqual([2, 1]);
  });

  it("always returns all three schools, even with nothing judged", () => {
    expect(rankSchools([], NONE)).toHaveLength(3);
  });
});

describe("yourTableLine", () => {
  it("says 'once' rather than '1 times'", () => {
    expect(yourTableLine(1, "Stoicism")).toBe("You argued once for Stoicism this week.");
  });

  it("counts above one, and says so when there is nothing yet", () => {
    expect(yourTableLine(3, "Stoicism")).toBe("You argued 3 times for Stoicism this week.");
    expect(yourTableLine(0, "Stoicism")).toBe(
      "You haven't argued for Stoicism this week yet."
    );
  });
});

describe("joinedLeftLabel", () => {
  it("spells out what the +/- cell means", () => {
    expect(joinedLeftLabel(2, 1)).toBe("2 joined, 1 left this week");
  });
});
