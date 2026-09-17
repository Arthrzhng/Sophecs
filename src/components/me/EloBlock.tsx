// The number is mono because it is measured; the label is not, because a
// label is a word. Both used to be mono, which made "ELO" read like data.
export function EloBlock({ elo, percentile }: { elo: number; percentile: number }) {
  return (
    <div>
      <p className="text-sm text-ink-soft">Rating</p>
      <p className="mt-1 font-mono text-lg tabular text-ink">{Math.round(elo)}</p>
      <p className="mt-1 max-w-[32ch] text-sm leading-relaxed text-ink-mid">
        Higher than {Math.round(percentile * 100)}% of debaters. It moves with
        every judged argument and means nothing on its own.
      </p>
    </div>
  );
}
