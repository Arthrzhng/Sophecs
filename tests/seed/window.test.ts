// What an extension adds (scripts/seed/window.ts): the rows a plan ending
// at the run's previous end did not hold. Arthur, 2026-11-09, item 28:
// "keep hourly and cut what each run reads". The extend reads only these,
// so the rule that picks them must be exactly the generator's.
import { describe, expect, it } from "vitest";
import { DEFAULTS, RUN_WEEKLY, generate, type Dataset, type GenConfig } from "../../scripts/seed/generate";
import { loadBanks } from "../../scripts/seed/banks";
import { contentTopics } from "../../scripts/seed/topics";
import { phases } from "../../scripts/seed/engine";
import { activeSince, keptFrom, newSince } from "../../scripts/seed/window";

const BASE_TO = "2026-11-09T06:00:00.000Z";
const DAY = 86_400_000;
const later = (days: number) => new Date(Date.parse(BASE_TO) + days * DAY).toISOString();
const banks = loadBanks();

function plan(to: string, extra: Partial<GenConfig>, small = false): Dataset {
  return generate(
    {
      seed: "window-check", from: small ? "2026-10-20T00:00:00.000Z" : DEFAULTS.from, baseTo: BASE_TO, to,
      users: small ? 120 : DEFAULTS.users, anonResults: small ? 150 : DEFAULTS.anonResults, challenges: small ? 10 : DEFAULTS.challenges,
      exchanges: small ? 12 : DEFAULTS.exchanges, classes: small ? 1 : DEFAULTS.classes, topics: contentTopics(), ...extra,
    },
    banks
  );
}

const ids = (ds: Dataset) => new Map(phases(ds).map((p) => [p.kind, new Set(p.items.map((i) => i.logicalId))]));

describe("the rows an extension adds", () => {
  for (const [label, extra, small] of [
    ["the scheduled job's weekly run", { quiz: 2, weekly: RUN_WEEKLY }, false],
    ["a run that names no quiz", {}, true],
  ] as const) {
    it(`are exactly those a plan ending earlier did not hold (${label})`, () => {
      for (const [a, b] of [[0, 1], [1.2, 3.5], [3.5, 10]]) {
        const earlier = plan(later(a), extra, small);
        const now = plan(later(b), extra, small);
        const before = ids(earlier);
        const fresh = newSince(now, later(a));
        for (const p of phases(now)) {
          const expected = new Set([...p.items.map((i) => i.logicalId)].filter((id) => !before.get(p.kind)!.has(id)));
          expect([...fresh.get(p.kind)!].sort(), `${label} ${a} to ${b}: ${p.kind}`).toEqual([...expected].sort());
          // And everything the earlier plan held is still there.
          for (const id of before.get(p.kind)!) expect(ids(now).get(p.kind)!.has(id), `${p.kind} ${id}`).toBe(true);
        }
      }
    });
  }

  it("names each account with something new, and nobody else: the only profiles an extension can change", () => {
    const earlier = plan(later(2), { quiz: 2, weekly: RUN_WEEKLY });
    const now = plan(later(3), { quiz: 2, weekly: RUN_WEEKLY });
    const active = activeSince(now, newSince(now, later(2)));
    expect(active.size).toBeGreaterThan(10);
    const before = new Map(earlier.profiles.map((p) => [p.rowId, p.row]));
    for (const p of now.profiles) {
      const was = before.get(p.rowId);
      const changed = !was || (["elo", "streak", "streak_updated_on", "school"] as const).some((k) => was[k] !== p.row[k]) || JSON.stringify(was.school_history) !== JSON.stringify(p.row.school_history);
      if (changed) expect(active.has(p.rowId), p.rowId).toBe(true);
    }
  });

  it("puts the base window's own rows in every plan", () => {
    const ds = plan(later(1), { quiz: 2, weekly: RUN_WEEKLY });
    const signups = new Map(ds.profiles.map((p) => [p.rowId, Date.parse(p.row.created_at)]));
    for (const p of phases(ds))
      if (!["auth_user", "profile", "quiz_result", "debate"].includes(p.kind))
        for (const i of p.items) expect(keptFrom(p.kind, i, signups)).toBe(-Infinity);
  });
});
