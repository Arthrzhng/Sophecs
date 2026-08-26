// Standard Elo with K=24, per the debate spec.
export const K_FACTOR = 24;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

export function ratingChange(
  rating: number,
  opponent: number,
  won: boolean
): number {
  const expected = expectedScore(rating, opponent);
  return Math.round(K_FACTOR * ((won ? 1 : 0) - expected));
}
