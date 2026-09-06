"use client";

import { useEffect, useState } from "react";
import { MicroLesson } from "./MicroLesson";
import { PublishToggle } from "./PublishToggle";
import { ShareRow } from "./ShareRow";
import { track } from "@/lib/analytics/client";
import { SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { MicroLessonContent } from "@/lib/micro-lessons";
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
}

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
}) {
  const [showAfter, setShowAfter] = useState(showAfterLessonInitially);

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
      </div>

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
