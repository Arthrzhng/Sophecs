// Ratings and streaks for sample accounts, replayed in time order with the
// app's own functions, in the order /api/judge applies them:
//
// 1. A rejected argument moves nothing and its ratings stay null.
// 2. A revision is pinned to its original's rating, before and after, and
//    is no streak day.
// 3. An original is rated by soloElo against the topic's par, and is a
//    streak day if it scores 40 or more (applyStreakDay, on its UTC date).
// 4. If it is one side of a challenge whose other side is already judged,
//    both sides are recomputed with pairwiseElo, and both profiles take the
//    pairwise result, as recordChallengeDebate does.
// 5. The topic's par becomes the mean of the last 50 originals' ratings
//    before (PAR_ELO_WINDOW in the judge route).
//
// The par here is the sample accounts' own, starting from 1200 per topic,
// and it is never written: debate_topics.par_elo and par_n are untouched,
// and /api/judge leaves sample debates out of the par it computes.

import { soloElo, pairwiseElo } from "../../src/lib/elo";
import { applyStreakDay, isStreakEligible, type StreakState } from "../../src/lib/streak";

export const PAR_ELO_WINDOW = 50;
export const START_ELO = 1200;

export interface ReplayDebate {
  t: number;
  row: {
    id: string;
    user_id: string;
    topic_slug: string;
    kind: "original" | "revision";
    parent_debate_id: string | null;
    rejected: boolean;
    score: number | null;
    challenge_id: string | null;
    elo_before: number | null;
    elo_after: number | null;
    elo_recomputed_at: string | null;
  };
}

export interface ReplayChallenge {
  id: string;
  challengerUser: string;
  challengeeUser: string;
}

export interface ReplayResult {
  profiles: Map<string, { elo: number; streak: number; streakUpdatedOn: string | null }>;
  par: Record<string, { par: number; n: number }>;
}

/** Mutates each debate's elo_before, elo_after and elo_recomputed_at. */
export function replay(
  debates: ReplayDebate[],
  challenges: ReplayChallenge[],
  topics: readonly string[]
): ReplayResult {
  const ordered = [...debates].sort((a, b) => a.t - b.t || a.row.id.localeCompare(b.row.id));
  const elo = new Map<string, number>();
  const streak = new Map<string, StreakState>();
  const window = new Map<string, number[]>(topics.map((t) => [t, []]));
  const par = new Map<string, number>(topics.map((t) => [t, START_ELO]));
  const byId = new Map(ordered.map((d) => [d.row.id, d]));
  const challengeById = new Map(challenges.map((c) => [c.id, c]));
  const sides = new Map<string, { challenger?: ReplayDebate; challengee?: ReplayDebate }>();

  for (const d of ordered) {
    const r = d.row;
    const user = r.user_id;
    if (!elo.has(user)) elo.set(user, START_ELO);
    if (!streak.has(user)) streak.set(user, { streak: 0, streakUpdatedOn: null });
    if (r.rejected || r.score === null) {
      r.elo_before = null;
      r.elo_after = null;
      continue;
    }
    if (r.kind === "revision") {
      const parent = byId.get(r.parent_debate_id!);
      const pinned = Number(parent?.row.elo_after ?? elo.get(user) ?? START_ELO);
      r.elo_before = pinned;
      r.elo_after = pinned;
      continue;
    }
    const before = elo.get(user)!;
    const { eloAfter } = soloElo(before, par.get(r.topic_slug)!, r.score);
    r.elo_before = before;
    r.elo_after = eloAfter;
    elo.set(user, eloAfter);
    if (isStreakEligible(r.score)) {
      const s = applyStreakDay(streak.get(user)!, new Date(d.t).toISOString().slice(0, 10));
      streak.set(user, { streak: s.streak, streakUpdatedOn: s.streakUpdatedOn });
    }

    if (r.challenge_id && challengeById.has(r.challenge_id)) {
      const c = challengeById.get(r.challenge_id)!;
      const entry = sides.get(c.id) ?? {};
      if (user === c.challengerUser) entry.challenger = d;
      else if (user === c.challengeeUser) entry.challengee = d;
      sides.set(c.id, entry);
      if (entry.challenger && entry.challengee) {
        const a = entry.challenger.row;
        const b = entry.challengee.row;
        const ra = pairwiseElo(Number(a.elo_before), Number(b.elo_before), Number(a.score), Number(b.score));
        const rb = pairwiseElo(Number(b.elo_before), Number(a.elo_before), Number(b.score), Number(a.score));
        const at = new Date(d.t).toISOString();
        a.elo_after = ra.eloAfter;
        b.elo_after = rb.eloAfter;
        a.elo_recomputed_at = at;
        b.elo_recomputed_at = at;
        elo.set(a.user_id, ra.eloAfter);
        elo.set(b.user_id, rb.eloAfter);
      }
    }

    const w = window.get(r.topic_slug)!;
    w.push(before);
    if (w.length > PAR_ELO_WINDOW) w.shift();
    par.set(r.topic_slug, w.reduce((s, v) => s + v, 0) / w.length);
  }

  const profiles = new Map<string, { elo: number; streak: number; streakUpdatedOn: string | null }>();
  for (const [user, e] of elo) {
    const s = streak.get(user)!;
    profiles.set(user, { elo: e, streak: s.streak, streakUpdatedOn: s.streakUpdatedOn });
  }
  return {
    profiles,
    par: Object.fromEntries(topics.map((t) => [t, { par: par.get(t)!, n: window.get(t)!.length }])),
  };
}
