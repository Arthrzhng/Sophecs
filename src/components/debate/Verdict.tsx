"use client";

import { useEffect, useState } from "react";
import { MicroLesson } from "./MicroLesson";
import { PublishToggle } from "./PublishToggle";
import { ShareRow } from "./ShareRow";
import { FindCounterpartButton } from "./FindCounterpartButton";
import { ButtonLink } from "@/components/ui/Button";
import { TextLink } from "@/components/ui/TextLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { track } from "@/lib/analytics/client";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { MicroLessonContent } from "@/lib/lesson-chunks";
import type { SchoolId } from "@/lib/types";

export interface VerdictData {
  rejected: boolean;
  rejection_reason?: string | null;
  score: number | null;
  fidelity: number | null;
  rigor: number | null;
  engagement: number | null;
  strongest_move?: string;
  weakest_move?: string;
  a_stronger_version_would?: string;
  verdict_line?: string;
  // v2 onwards. Absent on verdicts judged under v1, which exist in
  // production — every read of this is guarded.
  unanswered_objection?: {
    school: SchoolId;
    claim: string;
    why_it_stands: string;
  } | null;
  // Only ever set on a revision — the judge is shown the original and the
  // objection, and says whether the objection was actually engaged.
  objection_answered?: boolean;
  improvement_note?: string;
}

// The parent's four marks, so a revision can be read against its original.
export interface RevisionComparison {
  parentDebateId: string;
  first: {
    score: number | null;
    fidelity: number | null;
    rigor: number | null;
    engagement: number | null;
  };
}

const SCHOOL_LABEL: Record<SchoolId, string> = {
  stoicism: "Stoicism",
  utilitarianism: "Utilitarianism",
  "virtue-ethics": "Virtue Ethics",
};

// One axis. A table row, not a bar: three bars filled to 80% of their track
// is the one place in this product that looked like a dashboard, and a bar
// says "progress toward full marks" about a number that is a judgement.
function AxisRow({
  label,
  value,
  outOf,
  trailing,
}: {
  label: string;
  value: number | null;
  outOf?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <tr className="border-b border-rule last:border-b-0">
      <th scope="row" className="py-3 text-left text-sm font-normal text-ink-mid">
        {label}
      </th>
      <td className="py-3 text-right font-mono text-sm tabular text-ink">
        {/* The three sub-scores are fixed to one decimal so 8.0 and 6.5
            line up in the column; Overall is an integer and stays one. */}
        {value == null ? "—" : outOf ? value.toFixed(1) : value}
        {outOf && <span className="text-ink-soft">{outOf}</span>}
      </td>
      <td className="py-3 pl-6 text-right font-mono text-sm tabular text-ink-mid">{trailing}</td>
    </tr>
  );
}

// A signed number, never coloured. Green for up and red for down turns a
// rating change into a reward, which is the opposite of what a rubric is
// for.
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : "0";
}

// One row of the revision comparison. Deliberately monospaced and
// uncoloured: a delta is a number to read, not a verdict to feel.
function DeltaRow({
  label,
  before,
  after,
}: {
  label: string;
  before: number | null;
  after: number | null;
}) {
  const delta = before != null && after != null ? after - before : null;
  const fmt = (n: number | null) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <tr className="border-b border-rule last:border-b-0">
      <th scope="row" className="py-3 text-left text-sm font-normal text-ink-mid">
        {label}
      </th>
      <td className="py-3 text-right font-mono text-sm tabular text-ink-soft">
        {fmt(before)}
      </td>
      <td className="py-3 pl-4 text-right font-mono text-sm tabular text-ink">{fmt(after)}</td>
      <td className="py-3 pl-6 text-right font-mono text-sm tabular text-ink-mid">
        {delta == null ? "—" : signed(Number(delta.toFixed(1)))}
      </td>
    </tr>
  );
}

export function Verdict({
  debateId,
  topicSlug,
  motion,
  school,
  verdict,
  eloDelta,
  eloAfter,
  argument,
  isOwner,
  argumentPublic,
  afterLesson,
  showAfterLessonInitially,
  shareLine,
  hasRevision,
  comparison,
  counterpart,
}: {
  debateId: string;
  topicSlug: string;
  motion: string;
  school: SchoolId;
  verdict: VerdictData;
  eloDelta: number | null;
  eloAfter: number | null;
  argument: string | null;
  isOwner: boolean;
  argumentPublic: boolean;
  afterLesson: MicroLessonContent | null;
  showAfterLessonInitially: boolean;
  shareLine: string;
  hasRevision?: string | null;
  comparison?: RevisionComparison | null;
  // Absent on a revision and on someone else's verdict.
  counterpart?: { seeking: boolean; exchangeId: string | null } | null;
}) {
  const [showAfter, setShowAfter] = useState(showAfterLessonInitially);
  const objection = verdict.rejected ? null : verdict.unanswered_objection ?? null;

  // elo_changed fires once, from ArgumentEditor right after judging — not
  // here, since this component also renders on every later revisit of the
  // same verdict page and would otherwise re-fire it on each view.
  useEffect(() => {
    track({
      name: "verdict_viewed",
      props: { debate_id: debateId, score: verdict.score ?? 0, is_owner: isOwner, rejected: verdict.rejected },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (objection) {
      track({
        name: "objection_viewed",
        props: { debate_id: debateId, rival_school: objection.school, is_owner: isOwner },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showAfter && afterLesson) {
      track({ name: "micro_lesson_viewed", props: { slug: afterLesson.slug, position: "after" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAfter]);

  if (verdict.rejected) {
    return (
      <div>
        <p className="text-sm text-ink-soft">Verdict</p>
        <h1 className="mt-1 max-w-[60ch] font-serif text-lg font-medium leading-snug text-ink">
          {motion}
        </h1>
        <div className="mt-8">
          <ErrorState
            title="This was not judged."
            body={verdict.rejection_reason ?? "The judge returned no verdict for this argument."}
            action={
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <TextLink href={`/debate/${topicSlug}`}>Write it again</TextLink>
                <TextLink href="/debate/rubric">What the judge is looking for</TextLink>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-soft">Verdict</p>
      <h1 className="mt-1 max-w-[60ch] font-serif text-lg font-medium leading-snug text-ink">
        {motion}
      </h1>

      {/* Four axes, one table. Overall carries the ELO change beside it
          because that is the only row the change belongs to. */}
      <table className="mt-8 w-full max-w-[34rem] border-t border-rule">
        <caption className="sr-only">
          How this argument scored on each of the four axes
        </caption>
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="py-2 text-left text-sm font-normal text-ink-soft">
              Axis
            </th>
            <th scope="col" className="py-2 text-right text-sm font-normal text-ink-soft">
              Score
            </th>
            <th scope="col" className="py-2 pl-6 text-right text-sm font-normal text-ink-soft">
              ELO
            </th>
          </tr>
        </thead>
        <tbody>
          <AxisRow
            label="Overall"
            value={verdict.score}
            trailing={eloDelta == null ? "—" : signed(eloDelta)}
          />
          <AxisRow label={`Fidelity to ${SCHOOL_LABEL[school]}`} value={verdict.fidelity} outOf=" / 10" />
          <AxisRow label="Rigor" value={verdict.rigor} outOf=" / 10" />
          <AxisRow label="Engagement" value={verdict.engagement} outOf=" / 10" />
        </tbody>
      </table>
      <p className="mt-3 text-sm">
        <TextLink href="/debate/rubric">How this was judged</TextLink>
      </p>

      {/* The judge's reading of the argument, set as reading text rather
          than three labelled boxes. It is prose about your prose. */}
      <div className="mt-10 border-t border-rule pt-8">
        <p className="font-serif text-md leading-relaxed text-ink max-w-[66ch]">
          {verdict.verdict_line}
        </p>
        <div className="prose-reading mt-6">
          <p>{verdict.strongest_move}</p>
          <p>{verdict.weakest_move}</p>
          <p>{verdict.a_stronger_version_would}</p>
        </div>
      </div>

      {objection && (
        <div className="mt-10 max-w-[60ch] border-t border-rule pt-8">
          <p className="text-sm text-ink-soft">The objection you left standing</p>
          {/* The rival school's colour, on the rival school's objection —
              the one place on this screen a tribal marker means something. */}
          <div
            className="mt-4 border-l-2 pl-4"
            style={{ borderColor: SCHOOL_COLORS[objection.school].surface }}
          >
            <p className="text-sm text-ink-mid">{SCHOOL_LABEL[objection.school]}</p>
            <p className="mt-2 font-serif text-md leading-relaxed text-ink">{objection.claim}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-mid">{objection.why_it_stands}</p>
          </div>

          {/* A revision can't itself be revised — one attempt per objection,
              so the judge's new objection here is something to carry into the
              next motion rather than a button. */}
          {isOwner && comparison && (
            <p className="mt-6 text-sm text-ink-soft max-w-[50ch]">
              One revision per argument. Take this objection into your next motion.
            </p>
          )}

          {isOwner && !comparison && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {hasRevision ? (
                <TextLink href={`/debate/${topicSlug}/${hasRevision}`} className="text-sm">
                  Answered — read the revision
                </TextLink>
              ) : (
                <>
                  <ButtonLink
                    href={`/debate/${topicSlug}/${debateId}/revise`}
                    onClick={() =>
                      track({ name: "objection_answer_started", props: { debate_id: debateId } })
                    }
                  >
                    Answer it
                  </ButtonLink>
                  {/* A plain sentence, not a tooltip on a question mark. */}
                  <span className="text-sm text-ink-mid">
                    Answering does not change your ELO. Leave it and it waits on your profile.
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Below the objection block, not beside it: "Answer it" stays the
          primary move off a verdict, and this is the other thing you can do
          with the same argument. */}
      {isOwner && counterpart && !comparison && (
        <div className="mt-10 border-t border-rule pt-8">
          <p className="mb-3 text-sm text-ink-soft">Counterpart</p>
          <FindCounterpartButton
            debateId={debateId}
            topicSlug={topicSlug}
            initialSeeking={counterpart.seeking}
            existingExchangeId={counterpart.exchangeId}
          />
        </div>
      )}

      <div className="mt-10 border-t border-rule pt-8">
        {argument ? (
          <div className="max-w-[60ch]">
            <p className="font-sans text-xs text-ink-mid mb-2">The argument</p>
            <p className="font-serif text-base leading-relaxed whitespace-pre-wrap">{argument}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">The author has not published this argument.</p>
        )}
      </div>

      {afterLesson && (
        <div className="mt-10 border-t border-rule pt-8">
          {showAfter ? (
            <MicroLesson lesson={afterLesson} />
          ) : (
            <button
              type="button"
              onClick={() => setShowAfter(true)}
              className="font-mono text-xs text-ink-mid hover:text-ink underline underline-offset-4"
            >
              Read the objection again
            </button>
          )}
        </div>
      )}

      {comparison && (
        <div className="mt-10 max-w-[34rem] border-t border-rule pt-8">
          <p className="text-sm text-ink-soft">Compared with your first attempt</p>
  

          {verdict.objection_answered != null && (
            <p className="mt-6 text-sm text-ink">
              {verdict.objection_answered ? "Objection answered." : "Objection still standing."}
            </p>
          )}
          {verdict.improvement_note && (
            <p className="prose-reading mt-3">{verdict.improvement_note}</p>
          )}

          <p className="mt-6 text-sm">
            <TextLink href={`/debate/${topicSlug}/${comparison.parentDebateId}`}>
              Read the first attempt
            </TextLink>
          </p>
        </div>
      )}

      <div className="mt-10 border-t border-rule pt-8">
        <ShareRow debateId={debateId} topicSlug={topicSlug} score={verdict.score ?? 0} shareLine={shareLine} />
      </div>

      {isOwner && (
        <div className="mt-8">
          <PublishToggle debateId={debateId} initial={argumentPublic} />
        </div>
      )}
    </div>
  );
}
