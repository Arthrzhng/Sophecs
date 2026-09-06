import { describe, expect, it } from "vitest";
import { pairwiseElo, soloElo } from "../src/lib/elo";

describe("soloElo", () => {
  it("gains ELO for a perfect score against an even-strength topic", () => {
    const { delta, eloAfter } = soloElo(1200, 1200, 100);
    expect(delta).toBe(16);
    expect(eloAfter).toBe(1216);
  });

  it("loses ELO for a zero score against an even-strength topic", () => {
    const { delta, eloAfter } = soloElo(1200, 1200, 0);
    expect(delta).toBe(-16);
    expect(eloAfter).toBe(1184);
  });

  it("barely moves for a middling score against an even-strength topic", () => {
    const { delta, eloAfter } = soloElo(1200, 1200, 50);
    expect(delta).toBe(0);
    expect(eloAfter).toBe(1200);
  });

  it("expects less from a stronger debater against a weaker topic", () => {
    // Higher-rated than the topic's par ELO — even a strong score barely moves them.
    const strong = soloElo(1400, 1200, 80);
    const weak = soloElo(1000, 1200, 80);
    expect(strong.delta).toBeLessThan(weak.delta);
  });
});

describe("pairwiseElo", () => {
  it("rewards the higher score as a win", () => {
    const { delta, eloAfter } = pairwiseElo(1200, 1200, 80, 50);
    expect(delta).toBe(16);
    expect(eloAfter).toBe(1216);
  });

  it("treats scores within 3 points as a draw", () => {
    const exact = pairwiseElo(1200, 1200, 52, 50);
    expect(exact.delta).toBe(0);
    expect(exact.eloAfter).toBe(1200);

    const boundary = pairwiseElo(1200, 1200, 53, 50);
    expect(boundary.delta).toBe(0);
  });

  it("penalizes the lower score as a loss", () => {
    const { delta, eloAfter } = pairwiseElo(1200, 1200, 40, 70);
    expect(delta).toBe(-16);
    expect(eloAfter).toBe(1184);
  });

  it("recomputes both sides symmetrically once the second submission lands", () => {
    // Both start at the same ELO (the solo-scored provisional state before
    // a challenge's second side has submitted). Once both scores exist,
    // 2c recomputes both debates' ELO with the pairwise rule.
    const challengerElo = 1200;
    const challengeeElo = 1200;
    const challengerScore = 70;
    const challengeeScore = 60;

    const challenger = pairwiseElo(challengerElo, challengeeElo, challengerScore, challengeeScore);
    const challengee = pairwiseElo(challengeeElo, challengerElo, challengeeScore, challengerScore);

    expect(challenger.delta).toBeGreaterThan(0);
    expect(challengee.delta).toBeLessThan(0);
    // Equal starting ELO means the exchange is zero-sum.
    expect(challenger.delta + challengee.delta).toBe(0);
  });
});
