// A run is extended by moving `to` later (Arthur, 2026-11-04: permanent,
// generated on a schedule). That is only safe if a later `to` appends:
// every row up to the old `to` must come out the same, ids included, so
// the engine skips what is written and writes only what is new. What may
// change is a profile's rating, streak and school, which the engine
// updates.
import { describe, expect, it } from "vitest";
import { phases, PROFILE_MUTABLE } from "../../scripts/seed/engine";
import { describe as describeDs } from "../../scripts/seed/plan";
import { small, SMALL } from "./fixture";

const DAY = 86_400_000;
const later = (days: number) => new Date(Date.parse(SMALL.baseTo) + days * DAY).toISOString();

function rowsOf(ds: ReturnType<typeof small>) {
  const out = new Map<string, string>();
  for (const p of phases(ds))
    for (const it of p.items) {
      const row = { ...(it.row as Record<string, unknown>) };
      if (p.kind === "profile") for (const k of PROFILE_MUTABLE) delete row[k];
      out.set(`${p.kind}|${it.logicalId}`, JSON.stringify([it.rowId, row]));
    }
  for (const l of ds.challengeLinks) out.set(`link|${l.logicalId}`, JSON.stringify(l.row));
  return out;
}

describe("extending a run", () => {
  const base = small();
  const week = small({ to: later(7) });
  const month = small({ to: later(30) });

  it("keeps every row it had, the same, ids included", () => {
    for (const [a, b] of [
      [base, week],
      [week, month],
    ] as const) {
      const before = rowsOf(a);
      const after = rowsOf(b);
      const changed = [...before].filter(([k, v]) => after.get(k) !== v).map(([k]) => k);
      expect(changed).toEqual([]);
      expect(b.runId).toBe(a.runId);
    }
  });

  it("adds only arguments after the base window, and every one is later than the old end", () => {
    const before = rowsOf(base);
    const added = [...rowsOf(week).keys()].filter((k) => !before.has(k));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((k) => k.startsWith("debate|"))).toBe(true);
    const ids = new Set(added.map((k) => k.split("|")[1]));
    for (const d of week.debates.filter((x) => ids.has(x.logicalId))) expect(Date.parse(d.row.created_at)).toBeGreaterThan(Date.parse(SMALL.to));
  });

  it("keeps arguments coming week after week, from accounts that were already there", () => {
    const after = (ds: typeof month, from: number, to: number) =>
      ds.debates.filter((d) => {
        const t = Date.parse(d.row.created_at) - Date.parse(SMALL.baseTo);
        return t > from * DAY && t <= to * DAY;
      });
    expect(after(month, 0, 7).length).toBeGreaterThan(20);
    expect(after(month, 21, 28).length).toBeGreaterThan(10);
    const accounts = new Set(month.profiles.map((p) => p.rowId));
    expect(month.debates.every((d) => accounts.has(d.row.user_id))).toBe(true);
    expect(month.profiles.length).toBe(base.profiles.length);
  });

  it("keeps exact duplicate texts under 5%", () => {
    for (const ds of [base, month]) expect(Number((describeDs(ds) as { exactDuplicateArgumentsPct: number }).exactDuplicateArgumentsPct)).toBeLessThan(5);
  });

  it("refuses a `to` before the base window ends", () => {
    expect(() => small({ to: later(-1) })).toThrow(/before its base window ends/);
  });
});

describe("bringing a profile up to date", () => {
  it("sees no change where jsonb only reordered keys, and sees a real one", async () => {
    const { changedFields } = await import("../../scripts/seed/engine");
    const planned = { elo: 1216, streak: 2, streak_updated_on: "2026-11-01", school: "stoicism", school_history: [{ from: null, to: "stoicism", at: "2026-10-01T00:00:00.000Z" }] };
    const stored = { elo: "1216", streak: 2, streak_updated_on: "2026-11-01", school: "stoicism", school_history: [{ at: "2026-10-01T00:00:00.000Z", to: "stoicism", from: null }] };
    expect(changedFields(stored, planned)).toEqual({});
    expect(changedFields({ ...stored, elo: 1200, streak: 0 }, planned)).toEqual({ elo: 1216, streak: 2 });
  });
});
