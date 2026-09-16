"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MicroLesson } from "./MicroLesson";
import { PublishToggle } from "./PublishToggle";
import { ShareRow } from "./ShareRow";
import { FindCounterpartButton } from "./FindCounterpartButton";
import { track } from "@/lib/analytics/client";
import { SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
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

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-xs text-ink-mid">{label}</span>
        <span className="font-mono text-xs text-ink-soft">{value.toFixed(1)} / 10</span>
      </div>
      <div className="mt-1 h-px bg-rule relative">
        <div
          className="absolute inset-y-0 left-0 bg-ink"
          style={{ width: `${(value / 10) * 100}%`, height: 2, top: -0.5 }}
        />
      </div>
    </div>
  );
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
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-sans text-xs text-ink-mid">{label}</span>
      <span className="font-mono text-xs text-ink-soft tabular-nums">
        {fmt(before)} → <span className="text-ink">{fmt(after)}</span>
        {delta != null && (
          <span className="ml-3 text-ink-mid">
            {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
            {Math.abs(Number(delta.toFixed(1)))}
          </span>
        )}
      </span>
    </div>
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
        <p className="eyebrow text-ink-soft mb-4">Not judged</p>
        <p className="font-serif text-xl">{verdict.rejection_reason}</p>
        <p className="mt-4 text-sm text-ink-mid">{motion}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-6xl font-medium">{verdict.score}</span>
        {eloDelta != null && (
          <span className={`font-mono text-lg ${SCHOOL_TEXT_CLASS[school]}`}>
            {eloDelta >= 0 ? "+" : ""}
            {eloDelta} ELO
          </span>
        )}
      </div>

      <div className="mt-8 space-y-4 max-w-sm">
        <Bar label="Fidelity" value={verdict.fidelity ?? 0} />
        <Bar label="Rigor" value={verdict.rigor ?? 0} />
        <Bar label="Engagement" value={verdict.engagement ?? 0} />
        <Link
          href="/debate/rubric"
          className="inline-block font-sans text-xs text-ink-soft hover:text-ink underline underline-offset-4"
        >
          How this was judged
        </Link>
      </div>

      {objection && (
        <div className="mt-10 border-t border-rule pt-8 max-w-[55ch]">
          <p className={`eyebrow mb-2 ${SCHOOL_TEXT_CLASS[objection.school]}`}>
            Objection · {SCHOOL_LABEL[objection.school]}
          </p>
          <p className="font-sans text-xs text-ink-mid mb-3">The objection you left standing</p>
          <p className="font-serif text-lg leading-relaxed">{objection.claim}</p>
          <p className="mt-3 font-sans text-sm text-ink-mid leading-relaxed">
            {objection.why_it_stands}
          </p>

          {/* A revision can't itself be revised — one attempt per objection,
              so the judge's new objection here is something to carry into the
              next motion rather than a button. */}
          {isOwner && comparison && (
            <p className="mt-6 text-sm text-ink-soft max-w-[50ch]">
              One revision per argument. Take this objection into your next motion.
            </p>
          )}

          {isOwner && !comparison && (
            <div className="mt-6 flex flex-wrap items-center gap-6">
              {hasRevision ? (
                <Link
                  href={`/debate/${topicSlug}/${hasRevision}`}
                  className="text-sm font-medium text-ink-mid hover:text-ink underline underline-offset-4"
                >
                  Answered — read the revision
                </Link>
              ) : (
                <>
                  <Link
                    href={`/debate/${topicSlug}/${debateId}/revise`}
                    onClick={() =>
                      track({ name: "objection_answer_started", props: { debate_id: debateId } })
                    }
                    className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85"
                  >
                    Answer it
                  </Link>
                  <span className="text-sm text-ink-soft">
                    Later — it will wait on your profile
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-8 font-serif text-xl leading-snug max-w-[40ch]">{verdict.verdict_line}</p>

      <div className="mt-8 space-y-6 max-w-[55ch]">
        <div>
          <p className="font-sans text-xs text-ink-mid mb-1">Strongest move</p>
          <p className="font-serif text-base leading-relaxed">{verdict.strongest_move}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-mid mb-1">Weakest move</p>
          <p className="font-serif text-base leading-relaxed">{verdict.weakest_move}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-mid mb-1">A stronger version would</p>
          <p className="font-serif text-base leading-relaxed">{verdict.a_stronger_version_would}</p>
        </div>
      </div>

      {/* Below the objection block, not beside it: "Answer it" stays the
          primary move off a verdict, and this is the other thing you can do
          with the same argument. */}
      {isOwner && counterpart && !comparison && (
        <div className="mt-10 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-3">Counterpart</p>
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
        <div className="mt-10 border-t border-rule pt-8 max-w-sm">
          <p className="eyebrow text-ink-soft mb-4">Compared with your first attempt</p>
          <div className="space-y-2">
            <DeltaRow label="Score" before={comparison.first.score} after={verdict.score} />
            <DeltaRow label="Fidelity" before={comparison.first.fidelity} after={verdict.fidelity} />
            <DeltaRow label="Rigor" before={comparison.first.rigor} after={verdict.rigor} />
            <DeltaRow
              label="Engagement"
              before={comparison.first.engagement}
              after={verdict.engagement}
            />
          </div>

          {verdict.objection_answered != null && (
            <p className="mt-6 font-sans text-sm text-ink">
              {verdict.objection_answered ? "Objection answered" : "Objection still standing"}
            </p>
          )}
          {verdict.improvement_note && (
            <p className="mt-2 font-serif text-base leading-relaxed text-ink-mid max-w-[55ch]">
              {verdict.improvement_note}
            </p>
          )}

          <Link
            href={`/debate/${topicSlug}/${comparison.parentDebateId}`}
            className="mt-6 inline-block font-mono text-xs text-ink-mid hover:text-ink underline underline-offset-4"
          >
            Read the first attempt
          </Link>
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
