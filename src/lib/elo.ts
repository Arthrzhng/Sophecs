const K = 32;

function expectedScore(rSelf: number, rOpponent: number): number {
  return 1 / (1 + Math.pow(10, (rOpponent - rSelf) / 400));
}

export interface EloResult {
  eloAfter: number;
  delta: number;
}

// Solo debate: the opponent is the topic's par ELO, actual result is the
// judge's score/100. Never called for a rejected verdict — /api/judge
// leaves elo_before/elo_after null in that case.
export function soloElo(eloBefore: number, parElo: number, score: number): EloResult {
  const expected = expectedScore(eloBefore, parElo);
  const actual = score / 100;
  const delta = Math.round(K * (actual - expected));
  return { eloAfter: eloBefore + delta, delta };
}

// Challenge pair: opponent is the other participant's elo_before. A draw is
// any pair of scores within 3 points, not just an exact tie. Applied to
// both sides once the second submission is judged — see the Phase 2c
// challenge handoff (not wired to a route yet; this is the pure formula
// the brief's checklist asks to have tested ahead of that wiring).
export function pairwiseElo(
  eloBefore: number,
  opponentEloBefore: number,
  myScore: number,
  opponentScore: number
): EloResult {
  const expected = expectedScore(eloBefore, opponentEloBefore);
  const diff = myScore - opponentScore;
  const actual = Math.abs(diff) <= 3 ? 0.5 : diff > 0 ? 1 : 0;
  const delta = Math.round(K * (actual - expected));
  return { eloAfter: eloBefore + delta, delta };
}
