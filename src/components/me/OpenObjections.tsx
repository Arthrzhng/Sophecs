import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { OpenObjection } from "@/lib/objections";
import { ButtonLink } from "@/components/ui/Button";

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
        <p className="eyebrow text-ink-soft mb-4">Awaiting your answer</p>
        <p className="text-ink-mid">
          {hasAnyDebate
            ? "Every objection answered."
            : `You haven't defended ${school ? SCHOOL_COLORS[school as keyof typeof SCHOOL_COLORS]?.name ?? "your school" : "your school"} yet.`}
        </p>
        {weeklyMotion && (
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
            <p className="font-serif text-base">
              This week&apos;s motion: {weeklyMotion.title}
            </p>
            <ButtonLink
              href={`/debate/${weeklyMotion.slug}`}
            >
              Defend your school
            </ButtonLink>
          </div>
        )}
      </section>
    );
  }

  const shown = objections.slice(0, VISIBLE);
  const rest = objections.length - shown.length;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink-soft">Awaiting your answer</p>
        <span className="font-mono text-xs text-ink-soft">{objections.length}</span>
      </div>

      <ul className="mt-4 divide-y divide-rule border-t border-rule">
        {shown.map((o) => (
          <li key={o.debateId} className="py-5">
            <h3 className="font-serif text-lg font-medium">{o.topicTitle}</h3>
            <p className={`eyebrow-sm mt-1 ${SCHOOL_TEXT_CLASS[o.rivalSchool]}`}>
              Objection · {SCHOOL_COLORS[o.rivalSchool].name}
            </p>
            <p className="mt-2 font-serif text-base leading-relaxed max-w-[52ch]">{o.claim}</p>
            <ButtonLink
              href={`/debate/${o.topicSlug}/${o.debateId}/revise`}
            >
              Answer it
            </ButtonLink>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <details className="mt-4">
          <summary className="font-mono text-xs text-ink-soft cursor-pointer hover:text-ink">
            Show all ({objections.length})
          </summary>
          <ul className="mt-4 divide-y divide-rule border-t border-rule">
            {objections.slice(VISIBLE).map((o) => (
              <li key={o.debateId} className="py-5">
                <h3 className="font-serif text-lg font-medium">{o.topicTitle}</h3>
                <p className={`eyebrow-sm mt-1 ${SCHOOL_TEXT_CLASS[o.rivalSchool]}`}>
                  Objection · {SCHOOL_COLORS[o.rivalSchool].name}
                </p>
                <p className="mt-2 font-serif text-base leading-relaxed max-w-[52ch]">{o.claim}</p>
                <ButtonLink
                  href={`/debate/${o.topicSlug}/${o.debateId}/revise`}
                >
                  Answer it
                </ButtonLink>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
