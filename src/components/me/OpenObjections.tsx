import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { OpenObjection } from "@/lib/objections";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import type { SchoolId } from "@/lib/types";

const VISIBLE = 5;

// Leads /me. The open objection is the seven-day return mechanism: it sits
// here until answered, with no reminder, no email and no count-down — the
// pull is the unfinished argument itself, not a nudge. (AADC: no nudge
// techniques, no loss messaging.)
export function OpenObjections({
  objections,
  weeklyMotion,
  hasAnyDebate,
  school,
}: {
  objections: OpenObjection[];
  weeklyMotion: { slug: string; title: string } | null;
  hasAnyDebate: boolean;
  school: string | null;
}) {
  if (objections.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          Awaiting your answer
        </h2>
        <p className="mt-3 text-base text-ink-mid">
          {hasAnyDebate
            ? "Every objection answered."
            : `You haven't defended ${school ? SCHOOL_COLORS[school as keyof typeof SCHOOL_COLORS]?.name ?? "your school" : "your school"} yet.`}
        </p>
        {weeklyMotion && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border-2 border-rule bg-surface p-5">
            <p className="min-w-0 font-serif text-base text-ink">
              This week&apos;s motion: {weeklyMotion.title}
            </p>
            <ChunkyLink
              href={`/debate/${weeklyMotion.slug}`}
              school={(school as SchoolId | null) ?? "stoicism"}
            >
              Defend your school
            </ChunkyLink>
          </div>
        )}
      </section>
    );
  }

  const shown = objections.slice(0, VISIBLE);
  const rest = objections.length - shown.length;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">
          Awaiting your answer
        </h2>
        <span className="font-mono tabular text-sm font-bold text-ink-mid">
          {objections.length}
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {shown.map((o) => (
          <li key={o.debateId} className="rounded-card border-2 border-rule bg-surface p-5">
            <h3 className="font-serif text-md font-medium leading-snug text-ink">
              {o.topicTitle}
            </h3>
            <p className={`mt-2 text-sm font-bold ${SCHOOL_TEXT_CLASS[o.rivalSchool]}`}>
              Objection &middot; {SCHOOL_COLORS[o.rivalSchool].name}
            </p>
            <p className="mt-3 max-w-[52ch] font-serif text-base leading-relaxed text-ink">
              {o.claim}
            </p>
            <p className="mt-4">
              {/* The reader's own school, not the objector's: answering
                  is their action. Whose objection it is was said above,
                  in that school's colour. */}
              <ChunkyLink
                href={`/debate/${o.topicSlug}/${o.debateId}/revise`}
                school={(school as SchoolId | null) ?? o.rivalSchool}
              >
                Answer it
              </ChunkyLink>
            </p>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <details className="mt-5">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink underline underline-offset-4">
            Show all ({objections.length})
          </summary>
          <ul className="mt-4 flex flex-col gap-4">
            {objections.slice(VISIBLE).map((o) => (
              <li key={o.debateId} className="rounded-card border-2 border-rule bg-surface p-5">
                <h3 className="font-serif text-md font-medium leading-snug text-ink">
                  {o.topicTitle}
                </h3>
                <p className={`mt-2 text-sm font-bold ${SCHOOL_TEXT_CLASS[o.rivalSchool]}`}>
                  Objection &middot; {SCHOOL_COLORS[o.rivalSchool].name}
                </p>
                <p className="mt-3 max-w-[52ch] font-serif text-base leading-relaxed text-ink">
                  {o.claim}
                </p>
                <p className="mt-4">
                  <ChunkyLink
                    href={`/debate/${o.topicSlug}/${o.debateId}/revise`}
                    school={(school as SchoolId | null) ?? o.rivalSchool}
                  >
                    Answer it
                  </ChunkyLink>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
