export function StreakBlock({ streak }: { streak: number }) {
  return (
    <div>
      <p className="font-mono text-xs text-ink-soft">Streak</p>
      <p className="font-mono text-2xl mt-1">{streak}</p>
      <p className="mt-1 text-xs text-ink-soft">
        Days with a judged debate scoring 40 or more. Resets at midnight UTC.
      </p>
    </div>
  );
}
