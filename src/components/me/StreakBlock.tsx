import { streakLine } from "@/lib/streak-copy";

export function StreakBlock({ streak }: { streak: number }) {
  return (
    <div>
      <p className="text-sm text-ink-soft">Streak</p>
      <p className="mt-1 font-mono text-lg tabular text-ink">{streak}</p>
      <p className="mt-1 max-w-[32ch] text-sm leading-relaxed text-ink-mid">
        {streakLine(streak)}
      </p>
    </div>
  );
}
