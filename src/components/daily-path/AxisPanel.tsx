import Link from "next/link";
import { JUDGE_AXES } from "@/lib/judge-axes";

/**
 * What the judge looks for, on the screen where the argument is written.
 *
 * Three rows, not four. The composite score out of 100 is not one of them;
 * it appears on the verdict as the large circle.
 */
export function AxisPanel() {
  return (
    <section className="rounded-panel border-2 border-rule bg-surface p-5">
      <h2 className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        What the judge looks for
      </h2>
      <ol className="mt-4 space-y-4">
        {JUDGE_AXES.map((axis, i) => (
          <li key={axis.key}>
            <p className="flex items-baseline gap-2 text-base font-bold text-ink">
              <span className="font-mono tabular text-sm text-ink-mid">{i + 1}</span>
              {axis.label}
            </p>
            <p className="mt-1 max-w-[40ch] text-sm leading-relaxed text-ink-mid">
              {axis.description}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-5">
        <Link
          href="/debate/rubric"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Read the full rubric
        </Link>
      </p>
    </section>
  );
}
