import Link from "next/link";
import { CaseTicks } from "@/components/debate/CaseTicks";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SCHOOL_CHUNKY } from "@/components/daily-path/chunky";
import { OpenObjections } from "./OpenObjections";
import { OpenExchanges, type ExchangeRow } from "./OpenExchanges";
import { DisplayNameForm } from "./DisplayNameForm";
import { EloBlock } from "./EloBlock";
import { StreakBlock } from "./StreakBlock";
import { RatingChart } from "./RatingChart";
import { PendingChallenges } from "./PendingChallenges";
import { SCHOOL_ADHERENT, SCHOOL_COLORS } from "@/lib/school-colors";
import type { CaseState } from "@/lib/case-steps";
import type { PendingChallenge } from "@/lib/challenge";
import type { OpenObjection } from "@/lib/objections";
import type { RatingPoint } from "@/lib/rating-history";
import type { SchoolId } from "@/lib/types";

export interface ProfileDebate {
  id: string;
  topicSlug: string;
  score: number | null;
  rejected: boolean;
  revision?: { id: string; topicSlug: string; score: number | null; rejected: boolean };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t-2 border-rule pt-10">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * The profile, as a page.
 *
 * Presentational: /me reads eleven things out of Supabase and hands them
 * down, which is what lets the styleguide stand the page up against
 * fixtures. None of it can be rendered without a session otherwise, and a
 * profile with no debates and a profile with a chart are different enough
 * pages that both need looking at.
 */
export function ProfilePage({
  school,
  displayName,
  elo,
  percentile,
  streak,
  streakUpdatedOn,
  today,
  ratingPoints,
  objections,
  weeklyMotion,
  hasAnyDebate,
  exchanges,
  pendingChallenges,
  debates,
  caseStates,
  allClosed,
}: {
  school: SchoolId | null;
  displayName: string | null;
  elo: number;
  percentile: number;
  streak: number;
  streakUpdatedOn: string | null;
  today: string;
  ratingPoints: RatingPoint[];
  objections: OpenObjection[];
  weeklyMotion: { slug: string; title: string } | null;
  hasAnyDebate: boolean;
  exchanges: ExchangeRow[];
  pendingChallenges: PendingChallenge[];
  debates: ProfileDebate[];
  caseStates: Record<string, CaseState>;
  allClosed: boolean;
}) {
  return (
    <div className="mx-auto max-w-ui px-6 py-10">
      {/* The school is the page's subject, so it leads, in the same card
          /s/[school] uses: white, with the school's colour as a 4px left
          edge. The result card stays the only saturated surface. */}
      {school ? (
        <section
          className="rounded-card border-2 border-l-4 border-rule bg-surface p-6"
          style={{ borderLeftColor: SCHOOL_CHUNKY[school].bg }}
        >
          <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
            Your school
          </p>
          <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-ink">
            {SCHOOL_COLORS[school].name}
          </h1>
          {displayName && <p className="mt-2 text-sm text-ink-mid">{displayName}</p>}
        </section>
      ) : (
        <section className="rounded-card border-2 border-rule bg-surface p-6">
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink">Me</h1>
          <p className="mt-3 max-w-[50ch] text-base leading-relaxed text-ink-mid">
            No result attached to your account yet.
          </p>
          <p className="mt-4">
            <ChunkyLink href="/quiz" tone="ink">
              Take the quiz
            </ChunkyLink>
          </p>
        </section>
      )}

      {school && allClosed && (
        <p className="mt-6 max-w-[55ch] font-serif text-md leading-relaxed text-ink">
          You&apos;ve closed every motion as a {SCHOOL_ADHERENT[school]}.{" "}
          <Link href="/quiz" className="underline underline-offset-4">
            Retake the quiz
          </Link>{" "}
          to argue from another school, or wait for the next motion.
        </p>
      )}

      {/* Leads the page: the open objection is the reason to come back,
          so it sits above the rating and the streak. */}
      {school && (
        <div className="mt-12 border-t-2 border-rule pt-10">
          <OpenObjections
            objections={objections}
            weeklyMotion={weeklyMotion}
            hasAnyDebate={hasAnyDebate}
            school={school}
          />
        </div>
      )}

      {exchanges.length > 0 && (
        <div className="mt-12 border-t-2 border-rule pt-10">
          <OpenExchanges exchanges={exchanges} school={school} />
        </div>
      )}

      {school && (
        <Section title="Where you stand">
          <div className="grid gap-4 sm:grid-cols-2">
            <EloBlock elo={elo} percentile={percentile} />
            <StreakBlock streak={streak} streakUpdatedOn={streakUpdatedOn} today={today} />
          </div>
          {/* The rating over time, which the two cards above can only give
              as today's number. docs/daily-path-copy.md §9. */}
          {/* Unwrapped: RatingChart is already a bordered figure capped at
              its own width, because it sizes its text through the viewBox
              and cannot be stretched. A card around it was a border inside
              a border. */}
          <div className="mt-4">
            <RatingChart points={ratingPoints} />
          </div>
        </Section>
      )}

      <Section title="Pending challenges">
        <PendingChallenges challenges={pendingChallenges} />
      </Section>

      {debates.length > 0 && (
        <Section title="Debate history">
          <ul className="flex flex-col gap-3">
            {debates.map((d) => (
              <li key={d.id} className="rounded-card border-2 border-rule bg-surface p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    href={`/debate/${d.topicSlug}/${d.id}`}
                    className="text-sm font-bold text-ink underline-offset-4 hover:underline"
                  >
                    {d.topicSlug}
                  </Link>
                  <span className="font-mono tabular text-sm text-ink-mid">
                    {d.rejected ? "not judged" : d.score}
                  </span>
                </div>
                {caseStates[d.topicSlug] && (
                  <div className="mt-3">
                    <CaseTicks state={caseStates[d.topicSlug]} />
                  </div>
                )}
                {/* Nested, not listed alongside: a revision is the second
                    half of one attempt, and reads as nonsense on its own. */}
                {d.revision && (
                  <div className="mt-3 flex items-baseline justify-between gap-4 border-l-2 border-rule pl-4">
                    <Link
                      href={`/debate/${d.revision.topicSlug}/${d.revision.id}`}
                      className="text-sm text-ink-mid underline-offset-4 hover:text-ink hover:underline"
                    >
                      Revision
                    </Link>
                    <span className="font-mono tabular text-sm text-ink-soft">
                      {d.revision.rejected ? "not judged" : d.revision.score}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Display name">
        <DisplayNameForm initial={displayName} />
      </Section>

      <div className="mt-12 flex flex-wrap gap-5 border-t-2 border-rule pt-10">
        <Link
          href="/debate"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Debate
        </Link>
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
