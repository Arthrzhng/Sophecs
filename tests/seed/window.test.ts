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

// A run made since WEEKLY_RULES_FROM, so the weekly run here has every
// rule of Arthur's 2026-11-09 decisions.
const BASE_TO = "2026-11-16T06:00:00.000Z";
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
    it(`are exactly those a plan ending earlier did not hold (${label})`, { timeout: 180_000 }, () => {
      for (const [a, b] of [[0, 1.2], [1.2, 10]]) {
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

  // A newcomer's first quiz result is dated a few minutes before the
  // sign-up and written with the account, so an end that falls between
  // the two must not count it new until the sign-up (review pass 1 of the
  // run's decisions, O1).
  it("keeps a newcomer's first result with the account when an end falls between them", { timeout: 180_000 }, () => {
    const ds = plan(later(10), { quiz: 2, weekly: RUN_WEEKLY });
    const signups = new Map(ds.profiles.map((p) => [p.rowId, Date.parse(p.row.created_at)]));
    const gap = ds.quizResults.find((r) => {
      const s = r.row.user_id ? signups.get(r.row.user_id) : undefined;
      const t = Date.parse(r.row.created_at);
      return s !== undefined && t > Date.parse(BASE_TO) && s - t >= 10 * 60_000;
    });
    expect(gap, "a newcomer whose first result comes minutes before the sign-up").toBeDefined();
    const t = Date.parse(gap!.row.created_at);
    const since = new Date(Math.floor((t + signups.get(gap!.row.user_id!)!) / 2 / 60_000) * 60_000).toISOString();
    const earlier = plan(since, { quiz: 2, weekly: RUN_WEEKLY });
    const before = ids(earlier);
    const fresh = newSince(ds, since);
    expect(before.get("quiz_result")!.has(gap!.logicalId)).toBe(false);
    expect(fresh.get("quiz_result")!.has(gap!.logicalId)).toBe(true);
    for (const p of phases(ds)) {
      const expected = [...p.items.map((i) => i.logicalId)].filter((id) => !before.get(p.kind)!.has(id)).sort();
      expect([...fresh.get(p.kind)!].sort(), p.kind).toEqual(expected);
    }
  });

  it("names each account with something new, and nobody else: the only profiles an extension can change", { timeout: 120_000 }, () => {
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
