"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReadingFlow } from "./ReadingFlow";
import { ReadingCheck } from "./ReadingCheck";
import { ReadingCheckDone } from "./ReadingCheckDone";
import { ArgumentEditor } from "./ArgumentEditor";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { track } from "@/lib/analytics/client";
import { readingCheckScore, type MicroLessonContent } from "@/lib/lesson-chunks";
import { loadPicks, isCheckComplete, type Picks } from "@/lib/reading-check-progress";
import type { SchoolId } from "@/lib/types";

// Micro-lesson before -> reading check -> celebration -> editor, one route,
// client-state transitions (no nav) per the brief's numbered steps for
// /debate/[slug].
//
// The check sits after the whole passage and both typed notes and before
// the editor, which is where docs/daily-path-copy.md §2 puts it, and is why
// path steps 1 and 2 are two different signals rather than one.
type Phase = "reading" | "check" | "done" | "editor";

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
  const router = useRouter();
  const check = microBefore?.reading_check ?? null;
  const [phase, setPhase] = useState<Phase>(microBefore ? "reading" : "editor");
  // Lifted out of ReadingFlow: a note written during the reading has to
  // survive the switch to the editor, which happens without a navigation.
  const [responses, setResponses] = useState<Record<number, string>>(readingResponses);
  const [picks, setPicks] = useState<Picks>([]);

  // Storage is read on mount, never during render: a value that differed
  // between the server pass and the first client pass would break hydration.
  useEffect(() => {
    setPicks(loadPicks(userId, topicSlug));
  }, [userId, topicSlug]);

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

  // A reader who has already answered both questions on an earlier visit
  // goes straight on rather than being asked them again, the same courtesy
  // ReadingFlow already extends to the typed notes.
  const alreadyChecked = isCheckComplete(picks);

  // The check is a modal overlay, so the reading stays mounted underneath
  // it rather than being swapped out: an overlay over a blank page would
  // flash that page for a frame before the dialog opened, and leaving the
  // check by Escape would show it. It also keeps the passage's scroll
  // position for a reader who comes back to it.
  if (microBefore && (phase === "reading" || phase === "check")) {
    const next = check && !alreadyChecked ? "check" : "editor";
    return (
      <>
        <ReadingFlow
          lesson={microBefore}
          topicSlug={topicSlug}
          userId={userId}
          responses={responses}
          onResponse={(index, value) => setResponses((prev) => ({ ...prev, [index]: value }))}
          action={
            <ChunkyButton
              school={school}
              onClick={() => {
                // Fires here, at the click that leaves the lesson, which is
                // exactly where it fired before the check existed. The event
                // means the reader finished the reading and moved on; that
                // moment has not changed.
                begin();
                setPhase(next);
              }}
            >
              {next === "check" ? "Check your reading" : "Argue the motion"}
            </ChunkyButton>
          }
        />

        {phase === "check" && check && (
          <ReadingCheck
            check={check}
            topicSlug={topicSlug}
            userId={userId}
            school={school}
            // The X and Escape leave for Today rather than closing back
            // onto the lesson: the check is the step, and a reader who
            // stops mid-step has stopped for now. Nothing is recorded.
            onLeave={() => router.push("/today")}
            onDone={(final) => {
              setPicks(final);
              setPhase("done");
            }}
          />
        )}
      </>
    );
  }

  if (phase === "done" && check) {
    return (
      <ReadingCheckDone
        score={readingCheckScore(check, picks)}
        notesWritten={Object.keys(responses).length}
        school={school}
        onArgue={() => setPhase("editor")}
        onReadAgain={() => setPhase("reading")}
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
