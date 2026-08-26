"use client";

import { schoolColor, schoolName } from "@/lib/schools";
import type { QuizOutcome } from "@/lib/quiz";

// The one fully-saturated surface in the product. Rendered as DOM for now;
// image export hangs off ShareButton and is stubbed.
export function ResultCard({
  outcome,
  excerpt,
}: {
  outcome: QuizOutcome;
  excerpt: string;
}) {
  const school = outcome.assigned_school_id;

  const percentages = [
    { label: "STO", value: outcome.pct_stoic },
    { label: "UTI", value: outcome.pct_util },
    { label: "VIR", value: outcome.pct_virtue },
  ];

  return (
    <div
      className="rounded-lg px-8 py-10 sm:px-12 sm:py-12 text-[#FAFAF8]"
      style={{ backgroundColor: schoolColor(school) }}
    >
      <p className="eyebrow opacity-70">Assigned school</p>
      <p className="font-serif text-4xl sm:text-5xl font-medium mt-3 leading-none">
        {schoolName(school)}
      </p>

      <div className="mt-8 flex gap-8 font-mono text-sm">
        {percentages.map((pct) => (
          <span key={pct.label}>
            <span className="opacity-70">{pct.label}</span>{" "}
            <span className="font-medium">{pct.value}%</span>
          </span>
        ))}
      </div>

      <p className="mt-8 font-serif text-[17px] leading-[1.7] max-w-[52ch] border-t border-[rgba(250,250,248,0.25)] pt-6">
        {excerpt}
      </p>

      <p className="mt-8 font-serif font-semibold text-sm tracking-tight opacity-80">
        Sophecs
      </p>
    </div>
  );
}
