/**
 * Today's rating, and what it is worth.
 *
 * The number is mono because it is measured; the label is not, because a
 * label is a word. The sentence under it is the point: a rating with no
 * context is a score, and this product does not hand out scores.
 */
export function EloBlock({ elo, percentile }: { elo: number; percentile: number }) {
  return (
    <div className="rounded-card border-2 border-rule bg-surface p-5">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Rating</p>
      <p className="mt-2 font-mono tabular text-xl font-extrabold text-ink">
        {Math.round(elo)}
      </p>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-mid">
        Higher than {Math.round(percentile * 100)}% of debaters. It moves with
        every judged argument and means nothing on its own.
      </p>
    </div>
  );
}
