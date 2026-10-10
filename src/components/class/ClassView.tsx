import Link from "next/link";
import { CaseTicks } from "@/components/debate/CaseTicks";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { CaseState } from "@/lib/case-steps";
import type { SchoolId } from "@/lib/types";

export interface ClassMember {
  id: string;
  /** A display name, or "A Stoic", or "A student". Never an email. */
  name: string;
  school: SchoolId | null;
  states: Record<string, CaseState>;
}

/**
 * What a teacher sees.
 *
 * Presentational, so the styleguide can show it: the route needs a class
 * row, a membership row per student and a case state per motion, and a
 * class with nobody in it looks nothing like a class with four.
 *
 * Nothing on this page is pressed, so the colour rule has no actor to
 * follow. Each student's school sits on their own card, which is what a
 * marker is for. No score, no rating, no streak and no argument text: see
 * the note on the route.
 */
export function ClassView({
  name,
  code,
  members,
  topics,
}: {
  name: string;
  /** Shown only when nobody has joined, so there is something to share. */
  code: string;
  members: ClassMember[];
  topics: { slug: string; title: string }[];
}) {
  return (
    <div className="mx-auto max-w-ui px-6 py-10">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Class</p>
      <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
        {name}
      </h1>
      <p className="mt-3 max-w-[54ch] text-base leading-relaxed text-ink-mid">
        Whether each motion has been read, argued, answered and closed. Not
        arguments, scores or ratings.
      </p>

      {members.length === 0 ? (
        <p className="mt-10 text-base text-ink-mid">
          Nobody has joined yet. Share the code{" "}
          <span className="font-mono tabular font-bold text-ink">{code}</span> with
          your class.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-5">
          {members.map((member) => (
            <div key={member.id} className="rounded-card border-2 border-rule bg-surface p-5">
              {member.school && (
                <p className={`text-sm font-bold ${SCHOOL_TEXT_CLASS[member.school]}`}>
                  {SCHOOL_COLORS[member.school].name}
                </p>
              )}
              <h2 className="mt-1 font-serif text-md font-medium text-ink">{member.name}</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {topics.map((topic) => (
                  <li key={topic.slug}>
                    <p className="text-sm text-ink-mid">{topic.title}</p>
                    {member.states[topic.slug] ? (
                      <div className="mt-2">
                        <CaseTicks state={member.states[topic.slug]} />
                      </div>
                    ) : (
                      // A student who joined and has opened nothing. Said
                      // in words rather than left blank: an empty row
                      // reads as the page failing to load their progress.
                      <p className="mt-2 text-sm text-ink-soft">Not opened</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 border-t-2 border-rule pt-10">
        <Link
          href="/me/settings"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
