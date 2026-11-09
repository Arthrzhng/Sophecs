// The shape of a sample run made with the scheduled job's weekly settings
// (Arthur, 2026-11-08): "a site on course for about 4,000 users over three
// years: roughly 200 active accounts in any week, varying naturally week to
// week (e.g. 183, 207, 196), never a round number; total accounts about
// 700-800 now, growing by about 25 a week. Every school still gets at least
// 20 judged originals a week so all six stay ranked." And the hourly
// extension: a later `to` only appends.
import { describe, expect, it } from "vitest";
import { DEFAULTS, RUN_WEEKLY, generate, type Dataset } from "../../scripts/seed/generate";
import { loadBanks } from "../../scripts/seed/banks";
import { contentTopics } from "../../scripts/seed/topics";
import { PROFILE_MUTABLE, phases } from "../../scripts/seed/engine";

const BASE_TO = "2026-11-09T06:00:00.000Z";
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const SCHOOLS = ["stoicism", "utilitarianism", "virtue-ethics", "confucian", "ubuntu", "buddhist"];
const later = (days: number) => new Date(Date.parse(BASE_TO) + days * DAY).toISOString();

function run(to: string, seed = "weekly-check", baseTo = BASE_TO): Dataset {
  return generate(
    {
      seed, from: DEFAULTS.from, baseTo, to,
      users: DEFAULTS.users, anonResults: DEFAULTS.anonResults, challenges: DEFAULTS.challenges,
      exchanges: DEFAULTS.exchanges, classes: DEFAULTS.classes, quiz: 2, weekly: RUN_WEEKLY, topics: contentTopics(),
    },
    loadBanks()
  );
}

const mondayOf = (t: number) => {
  const d = Math.floor(t / DAY) * DAY;
  return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY;
};

/** Per ISO week: active accounts (an argument or a quiz result), newcomers, judged originals by school. */
function weeks(ds: Dataset) {
  const out = new Map<number, { active: Set<string>; joined: number; originals: Map<string, number> }>();
  const at = (iso: string) => {
    const w = mondayOf(Date.parse(iso));
    if (!out.has(w)) out.set(w, { active: new Set(), joined: 0, originals: new Map() });
    return out.get(w)!;
  };
  for (const { row } of ds.debates) {
    const w = at(row.created_at);
    w.active.add(row.user_id);
    if (row.kind === "original" && !row.rejected && row.verdict) w.originals.set(row.school, (w.originals.get(row.school) ?? 0) + 1);
  }
  for (const { row } of ds.quizResults) if (row.user_id) at(row.created_at).active.add(row.user_id);
  for (const { row } of ds.profiles) at(row.created_at).joined++;
  return out;
}

describe("a sample run made with the weekly settings", () => {
  for (const seed of ["weekly-check", "another"]) {
    it(`grows like a site on course for 4,000 accounts, every week after its start (seed ${seed})`, () => {
      const ds = run(later(7 * 13), seed);
      const atStart = ds.profiles.filter((p) => Date.parse(p.row.created_at) <= Date.parse(BASE_TO)).length;
      expect(atStart).toBeGreaterThanOrEqual(700);
      expect(atStart).toBeLessThanOrEqual(800);
      const full = [...weeks(ds).entries()].filter(([w]) => w > Date.parse(BASE_TO) && w + WEEK <= Date.parse(later(7 * 13)));
      expect(full.length).toBeGreaterThanOrEqual(11);
      const joined: number[] = [];
      for (const [w, week] of full) {
        const label = new Date(w).toISOString().slice(0, 10);
        expect(week.active.size, label).toBeGreaterThanOrEqual(170);
        expect(week.active.size, label).toBeLessThanOrEqual(230);
        expect(week.active.size % 10, label).not.toBe(0);
        for (const school of SCHOOLS) expect(week.originals.get(school) ?? 0, `${label} ${school}`).toBeGreaterThanOrEqual(RUN_WEEKLY!.minPerSchool);
        expect(week.joined, label).toBeGreaterThanOrEqual(10);
        expect(week.joined, label).toBeLessThanOrEqual(45);
        joined.push(week.joined);
      }
      const mean = joined.reduce((a, b) => a + b, 0) / joined.length;
      expect(mean).toBeGreaterThan(20);
      expect(mean).toBeLessThan(30);
      // The weeks are not all alike.
      expect(new Set(full.map(([, w]) => w.active.size)).size).toBeGreaterThan(full.length / 2);
    });
  }

  // The week the base window ends in is drawn whole and kept from the base
  // window's end (review of #115, B1): no burst of the week's draw into what
  // is left of it, and no lull until the next Monday. Started late on a
  // Sunday, as the scheduled job's first run after a teardown can be; on a
  // Wednesday afternoon; early on a Monday.
  for (const [label, baseTo] of [
    ["late on a Sunday", "2026-11-08T23:41:00.000Z"],
    ["on a Wednesday afternoon", "2026-11-11T14:41:00.000Z"],
    ["early on a Monday", "2026-11-09T03:17:00.000Z"],
  ] as const) {
    it(`started ${label}, its first week runs at the rate of the weeks after it`, () => {
      const start = Date.parse(baseTo);
      const firstMonday = mondayOf(start);
      const end = firstMonday + 3 * WEEK;
      const ds = run(new Date(end).toISOString(), "first-week", baseTo);
      const perHour = new Map<number, number>();
      let after = 0;
      for (const { row } of ds.debates) {
        const t = Date.parse(row.created_at);
        if (t <= start) continue;
        after++;
        perHour.set(Math.floor(t / 3_600_000), (perHour.get(Math.floor(t / 3_600_000)) ?? 0) + 1);
      }
      const mean = after / ((end - start) / 3_600_000);
      // The busiest hour after the base window's end is a busy hour, not a burst.
      expect(Math.max(...perHour.values())).toBeLessThanOrEqual(Math.max(15, 8 * mean));
      const byWeek = weeks(ds);
      const first = byWeek.get(firstMonday)!;
      const next = byWeek.get(firstMonday + WEEK)!;
      // The first week is neither swollen nor empty beside the next.
      expect(first.active.size).toBeGreaterThan(0.6 * next.active.size);
      expect(first.active.size).toBeLessThan(1.25 * next.active.size);
      // Started with a day or more of the week left, every school is ranked in it.
      if (firstMonday + WEEK - start >= DAY)
        for (const school of SCHOOLS) expect(first.originals.get(school) ?? 0, school).toBeGreaterThanOrEqual(RUN_WEEKLY!.minPerSchool);
    });
  }

  // Arthur, 2026-11-09, items 9, 11 and 13.
  for (const seed of ["weekly-check", "another"]) {
    it(`keeps every school ranked in every seven days from the start, not only every ISO week (item 9, seed ${seed})`, { timeout: 120_000 }, () => {
      const end = later(7 * 6);
      const ds = run(end, seed);
      const judged = new Map(SCHOOLS.map((x) => [x, [] as number[]]));
      for (const { row } of ds.debates) if (row.kind === "original" && !row.rejected && row.verdict) judged.get(row.school)!.push(Date.parse(row.created_at));
      // Every seven days ending in the run, checked every ten minutes.
      for (let t = Date.parse(BASE_TO); t <= Date.parse(end); t += 10 * 60_000)
        for (const school of SCHOOLS) {
          const n = judged.get(school)!.filter((x) => x > t - WEEK && x <= t).length;
          if (n < RUN_WEEKLY!.minPerSchool) expect(n, `${school}, seven days to ${new Date(t).toISOString()}`).toBeGreaterThanOrEqual(RUN_WEEKLY!.minPerSchool);
        }
    });

    it(`brings anonymous quiz takers every week, and eases its sign-ups into the weeks with no cliff (items 11 and 13, seed ${seed})`, { timeout: 120_000 }, () => {
      const ds = run(later(7 * 6), seed);
      const start = Date.parse(BASE_TO);
      const perWeek = (ts: number[], k: number) => ts.filter((t) => t > start + k * WEEK && t <= start + (k + 1) * WEEK).length;
      const anon = ds.quizResults.filter((q) => !q.row.user_id).map((q) => Date.parse(q.row.created_at));
      for (let k = 0; k < 6; k++) {
        expect(perWeek(anon, k), `anonymous, week ${k}`).toBeGreaterThanOrEqual(15);
        expect(perWeek(anon, k), `anonymous, week ${k}`).toBeLessThanOrEqual(60);
      }
      // Sign-ups: the base window's last six weeks ease down to the weeks' rate.
      const signups = ds.profiles.map((p) => Date.parse(p.row.created_at));
      const weeks = Array.from({ length: 12 }, (_, i) => perWeek(signups, i - 6));
      expect(weeks[5], "the base window's last week").toBeLessThanOrEqual(45);
      expect(weeks[5], "the base window's last week").toBeGreaterThanOrEqual(10);
      for (let i = 1; i < 6; i++) expect(weeks[i], `week ${i - 6}: ${weeks.join(", ")}`).toBeGreaterThanOrEqual(0.4 * weeks[i - 1]);
      // And active accounts run on at the weeks' level through the base window's end.
      const act = new Map<number, Set<string>>();
      const add = (iso: string, u: string) => {
        const w = mondayOf(Date.parse(iso));
        if (!act.has(w)) act.set(w, new Set());
        act.get(w)!.add(u);
      };
      for (const { row } of ds.debates) add(row.created_at, row.user_id);
      for (const { row } of ds.quizResults) if (row.user_id) add(row.created_at, row.user_id);
      for (let w = mondayOf(start) - 5 * WEEK; w <= mondayOf(start) + 4 * WEEK; w += WEEK) {
        const n = act.get(w)?.size ?? 0;
        expect(n, new Date(w).toISOString().slice(0, 10)).toBeGreaterThanOrEqual(160);
        expect(n, new Date(w).toISOString().slice(0, 10)).toBeLessThanOrEqual(240);
      }
    });
  }

  it("a later end only appends: every row written by an earlier end is the same, profiles aside from what they keep up to date", () => {
    const a = run(later(10));
    const b = run(later(24));
    const byId = new Map(phases(b).flatMap((p) => p.items.map((i) => [`${p.kind}/${i.logicalId}`, i] as const)));
    let compared = 0;
    for (const p of phases(a)) {
      for (const item of p.items) {
        const other = byId.get(`${p.kind}/${item.logicalId}`);
        expect(other, `${p.kind} ${item.logicalId}`).toBeDefined();
        const strip = (row: Record<string, unknown>) =>
          p.kind === "profile" ? Object.fromEntries(Object.entries(row).filter(([k]) => !(PROFILE_MUTABLE as readonly string[]).includes(k))) : row;
        expect(strip(other!.row as Record<string, unknown>), `${p.kind} ${item.logicalId}`).toEqual(strip(item.row as Record<string, unknown>));
        expect(other!.rowId).toBe(item.rowId);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(5000);
    // And the later end has more of everything that grows.
    expect(b.profiles.length).toBeGreaterThan(a.profiles.length);
    expect(b.debates.length).toBeGreaterThan(a.debates.length);
  });

  it("dates nothing after its end, and keeps a profile's school as it stood then", () => {
    const end = later(17);
    const ds = run(end);
    for (const p of phases(ds))
      for (const { row } of p.items) {
        const t = (row as { created_at?: string }).created_at;
        if (t) expect(Date.parse(t), `${p.kind}`).toBeLessThanOrEqual(Date.parse(end));
      }
    const last = new Map<string, { at: string; school: string }>();
    for (const { row } of ds.quizResults) if (row.user_id && (!last.has(row.user_id) || last.get(row.user_id)!.at <= row.created_at)) last.set(row.user_id, { at: row.created_at, school: row.school });
    for (const { row } of ds.profiles) {
      expect(row.school, row.id).toBe(last.get(row.id)!.school);
      for (const h of row.school_history) expect(Date.parse(h.at)).toBeLessThanOrEqual(Date.parse(end));
    }
  });

  it("gives the canary the base window's first accounts, and is a quiz v2 run only", () => {
    const ds = run(later(10));
    const canary = ds.profiles.filter((p) => p.cohort < 40);
    expect(canary).toHaveLength(40);
    for (const p of canary) expect(Date.parse(p.row.created_at)).toBeLessThan(Date.parse(BASE_TO));
    expect(() =>
      generate(
        { seed: "x", from: DEFAULTS.from, baseTo: BASE_TO, to: BASE_TO, users: 200, anonResults: 100, challenges: 10, exchanges: 10, classes: 1, weekly: RUN_WEEKLY, topics: contentTopics() },
        loadBanks()
      )
    ).toThrow(/quiz v2/);
  });
});
