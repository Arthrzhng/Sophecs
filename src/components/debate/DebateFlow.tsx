"use client";

import { useEffect, useState } from "react";
import { MicroLesson } from "./MicroLesson";
import { ArgumentEditor } from "./ArgumentEditor";
import { track } from "@/lib/analytics/client";
import type { MicroLessonContent } from "@/lib/micro-lessons";
import type { SchoolId } from "@/lib/types";

// Micro-lesson before -> editor, one route, client-state transition (no
// nav) per the brief's numbered steps for /debate/[slug].
export function DebateFlow({
  topicSlug,
  motion,
  school,
  microBefore,
  userId,
  challengeId,
}: {
  topicSlug: string;
  motion: string;
  school: SchoolId;
  microBefore: MicroLessonContent | null;
  userId: string;
  challengeId?: string;
}) {
  const [began, setBegan] = useState(!microBefore);

  function begin() {
    track({
      name: "debate_started",
      props: { topic_slug: topicSlug, from_challenge: Boolean(challengeId) },
    });
    if (challengeId) {
      track({ name: "challenge_debate_started", props: { challenge_id: challengeId } });
    }
  }

  useEffect(() => {
    if (microBefore) {
      track({
        name: "micro_lesson_viewed",
        props: { slug: microBefore.slug, position: "before" },
      });
    } else {
      // No lesson to click through (content not seeded yet) — this is the
      // start of the debate regardless, so fire it here instead of losing
      // it entirely.
      begin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!began && microBefore) {
    return (
      <MicroLesson
        lesson={microBefore}
        action={
          <button
            type="button"
            onClick={() => {
              begin();
              setBegan(true);
            }}
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85"
          >
            Begin
          </button>
        }
      />
    );
  }

  return (
    <ArgumentEditor
      topicSlug={topicSlug}
      motion={motion}
      school={school}
      userId={userId}
      challengeId={challengeId}
    />
  );
}
