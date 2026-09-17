"use client";

import { useEffect, useState } from "react";
import { ReadingFlow } from "./ReadingFlow";
import { ArgumentEditor } from "./ArgumentEditor";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/client";
import type { MicroLessonContent } from "@/lib/lesson-chunks";
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
  isAllowlisted,
  isFirstArgument,
  readingResponses,
}: {
  topicSlug: string;
  motion: string;
  school: SchoolId;
  microBefore: MicroLessonContent | null;
  userId: string;
  challengeId?: string;
  isAllowlisted?: boolean;
  isFirstArgument?: boolean;
  readingResponses: Record<number, string>;
}) {
  const [began, setBegan] = useState(!microBefore);
  // Lifted out of ReadingFlow: a note written during the reading has to
  // survive the switch to the editor, which happens without a navigation.
  const [responses, setResponses] = useState<Record<number, string>>(readingResponses);

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
      <ReadingFlow
        lesson={microBefore}
        topicSlug={topicSlug}
        userId={userId}
        responses={responses}
        onResponse={(index, value) => setResponses((prev) => ({ ...prev, [index]: value }))}
        action={
          <Button
            onClick={() => {
              begin();
              setBegan(true);
            }}
          >
            Start writing
          </Button>
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
      isAllowlisted={isAllowlisted}
      isFirstArgument={isFirstArgument}
      // Carried through to the editor as a disclosure, so the excerpt is
      // still there to quote from while the argument is being written
      // rather than a screen the reader clicked past.
      microBefore={microBefore}
      readingNotes={Object.keys(responses)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => responses[i])}
    />
  );
}
