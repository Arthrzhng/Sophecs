import { CASE_STEPS, caseTicks, type CaseState } from "@/lib/case-steps";

/**
 * How far a case has got: four marks, named.
 *
 * Never colour-coded. Done against not-done is the fill and the height of
 * the bar, and the whole thing is also read out as one label, so nothing
 * here depends on seeing a hue.
 *
 * The step names are in sans now, not mono. Mono carries numbers in this
 * product and "Argued" is not one; it was reading as a terminal log.
 */
export function CaseTicks({ state }: { state: CaseState }) {
  const ticks = caseTicks(state);
  const label = CASE_STEPS.map((step, i) => `${step}: ${ticks[i] ? "done" : "not yet"}`).join(", ");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="img" aria-label={label}>
      {CASE_STEPS.map((step, i) => (
        <span key={step} className="flex items-center gap-2" aria-hidden="true">
          <span
            className={`inline-block h-1 w-5 rounded-badge ${ticks[i] ? "bg-ink" : "bg-rule-strong"}`}
          />
          <span className={`text-xs ${ticks[i] ? "font-bold text-ink" : "text-ink-soft"}`}>
            {step}
          </span>
        </span>
      ))}
    </div>
  );
}
