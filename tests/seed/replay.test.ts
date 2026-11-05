// The replay is the app's rating and streak code run in time order: these
// tests rebuild the expected numbers by hand with the same functions and
// compare, and check the generated profiles end where their arguments
// leave them.
import { describe, expect, it } from "vitest";
import { soloElo, pairwiseElo } from "../../src/lib/elo";
import { replay, type ReplayDebate } from "../../scripts/seed/replay";
import { small } from "./fixture";

const D = (id: string, user: string, t: number, score: number | null, extra: Partial<ReplayDebate["row"]> = {}): ReplayDebate => ({
  t,
  row: {
    id, user_id: user, topic_slug: "opaque-benefit", kind: "original", parent_debate_id: null, rejected: score === null,
    score, challenge_id: null, elo_before: null, elo_after: null, elo_recomputed_at: null, ...extra,
  },
});
const DAY = 86_400_000;

describe("replay", () => {
  it("rates originals with soloElo against a par it keeps itself", () => {
    const ds = [D("a", "u1", 1, 80), D("b", "u2", 2, 30), D("c", "u1", 3, 60)];
    replay(ds, [], ["opaque-benefit"]);
    const a = soloElo(1200, 1200, 80);
    expect(ds[0].row.elo_after).toBe(a.eloAfter);
    // The par after one original is that original's rating before.
    const b = soloElo(1200, 1200, 30);
    expect(ds[1].row.elo_after).toBe(b.eloAfter);
    const c = soloElo(a.eloAfter, (1200 + 1200) / 2, 60);
    expect(ds[2].row.elo_before).toBe(a.eloAfter);
    expect(ds[2].row.elo_after).toBe(c.eloAfter);
  });

  it("pins a revision to its original and leaves rejections unrated", () => {
    const ds = [D("a", "u1", 1, 70), D("r", "u1", 2, 85, { kind: "revision", parent_debate_id: "a" }), D("x", "u1", 3, null)];
    const res = replay(ds, [], ["opaque-benefit"]);
    expect(ds[1].row.elo_before).toBe(ds[0].row.elo_after);
    expect(ds[1].row.elo_after).toBe(ds[0].row.elo_after);
    expect([ds[2].row.elo_before, ds[2].row.elo_after]).toEqual([null, null]);
    expect(res.profiles.get("u1")!.elo).toBe(ds[0].row.elo_after);
  });

  it("recomputes both sides of a challenge with pairwiseElo, as recordChallengeDebate does", () => {
    const ds = [D("a", "u1", 1, 82, { challenge_id: "c1" }), D("b", "u2", 2, 55, { challenge_id: "c1" })];
    const res = replay(ds, [{ id: "c1", challengerUser: "u1", challengeeUser: "u2" }], ["opaque-benefit"]);
    const ea = Number(ds[0].row.elo_before);
    const eb = Number(ds[1].row.elo_before);
    expect(ds[0].row.elo_after).toBe(pairwiseElo(ea, eb, 82, 55).eloAfter);
    expect(ds[1].row.elo_after).toBe(pairwiseElo(eb, ea, 55, 82).eloAfter);
    expect(res.profiles.get("u1")!.elo).toBe(ds[0].row.elo_after);
    expect(ds[0].row.elo_recomputed_at).not.toBeNull();
  });

  it("counts streak days with applyStreakDay on UTC dates, from 40 up", () => {
    const base = Date.parse("2026-10-01T20:00:00Z");
    const ds = [D("a", "u1", base, 45), D("b", "u1", base + DAY, 39), D("c", "u1", base + DAY + 1000, 41), D("d", "u1", base + 3 * DAY, 60)];
    const res = replay(ds, [], ["opaque-benefit"]);
    expect(res.profiles.get("u1")).toMatchObject({ streak: 1, streakUpdatedOn: "2026-10-04" });
    const ds2 = [D("a", "u1", base, 45), D("b", "u1", base + DAY, 50)];
    expect(replay(ds2, [], ["opaque-benefit"]).profiles.get("u1")!.streak).toBe(2);
  });

  it("leaves each generated profile where its arguments leave it", () => {
    const ds = small();
    const last = new Map<string, { t: number; elo: number }>();
    // Originals only: a revision is pinned to its own original's rating,
    // which need not be the profile's latest.
    for (const d of ds.debates) {
      if (d.row.elo_after === null || d.row.kind !== "original") continue;
      const t = Date.parse(d.row.created_at);
      const prev = last.get(d.row.user_id);
      if (!prev || t >= prev.t) last.set(d.row.user_id, { t, elo: Number(d.row.elo_after) });
    }
    for (const p of ds.profiles) {
      const l = last.get(p.row.id);
      // A challenge recomputed later can move a profile after its last
      // argument; every other profile ends on its last rated argument.
      const recomputed = ds.debates.some((d) => d.row.user_id === p.row.id && d.row.elo_recomputed_at);
      if (!l) expect(p.row.elo).toBe(1200);
      else if (!recomputed) expect(p.row.elo).toBe(l.elo);
    }
  });

  it("writes no topic par: the sample calibration is reported, never applied", () => {
    const ds = small();
    expect(Object.keys(ds.sampleParElo).sort()).toHaveLength(6);
    expect(JSON.stringify(Object.keys(ds))).not.toContain("debate_topics");
  });
});
