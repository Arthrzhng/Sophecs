import { CASE_STEPS, caseTicks, type CaseState } from "@/lib/case-steps";

// Four hairline ticks, ink only. Never colour-coded: the difference between
// done and not-done is the fill, and the state is also in the aria-label,
// so nothing here depends on seeing a hue.
export function CaseTicks({ state }: { state: CaseState }) {
  const ticks = caseTicks(state);
  const label = CASE_STEPS.map((step, i) => `${step}: ${ticks[i] ? "done" : "not yet"}`).join(", ");

  return (
    <div className="flex items-center gap-3" role="img" aria-label={label}>
      {CASE_STEPS.map((step, i) => (
        <span key={step} className="flex items-center gap-1.5" aria-hidden="true">
          <span
            className={`inline-block h-px w-4 ${ticks[i] ? "bg-ink" : "bg-rule"}`}
            style={{ height: ticks[i] ? 2 : 1 }}
          />
          <span className={`font-mono text-xs ${ticks[i] ? "text-ink-mid" : "text-ink-soft"}`}>
            {step}
          </span>
        </span>
      ))}
    </div>
  );
}
