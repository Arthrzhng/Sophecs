import type { ReactNode } from "react";

/**
 * The small bordered number tile used on the celebration and the verdict.
 *
 * The value is mono because every number in this product is
 * (design/tokens.md), and the label sits above it in the interface face.
 */
export function StatTile({
  label,
  value,
  tone = "plain",
  className = "",
}: {
  label: string;
  value: ReactNode;
  tone?: "plain" | "streak";
  className?: string;
}) {
  const toned =
    tone === "streak"
      ? "border-[color:var(--color-streak)] bg-[color:var(--color-wrong-tint)]"
      : "border-rule bg-surface";
  return (
    <div className={`rounded-card border-2 p-4 ${toned} ${className}`}>
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        {label}
      </p>
      <p className="mt-1 font-mono tabular text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}
