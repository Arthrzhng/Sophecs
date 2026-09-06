export function EloBlock({ elo, percentile }: { elo: number; percentile: number }) {
  return (
    <div>
      <p className="font-mono text-xs text-ink-soft">ELO</p>
      <p className="font-mono text-2xl mt-1">{Math.round(elo)}</p>
      <p className="mt-1 text-xs text-ink-soft">
        Higher than {Math.round(percentile * 100)}% of debaters.
      </p>
    </div>
  );
}
