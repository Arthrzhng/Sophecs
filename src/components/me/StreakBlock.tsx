export function StreakBlock({ streak }: { streak: number }) {
  return (
    <div>
      <p className="text-sm text-ink-soft">Streak</p>
      <p className="mt-1 font-mono text-lg tabular text-ink">{streak}</p>
      <p className="mt-1 max-w-[32ch] text-sm leading-relaxed text-ink-mid">
        {streak === 0
          ? "Days in a row with a judged argument scoring 40 or more. Nothing happens when it breaks."
          : `${streak === 1 ? "Day" : "Days"} in a row with a judged argument scoring 40 or more. Resets at midnight UTC.`}
      </p>
    </div>
  );
}
