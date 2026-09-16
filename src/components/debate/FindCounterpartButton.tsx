"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { seekCounterpart } from "@/app/debate/actions";
import { track } from "@/lib/analytics/client";

// Secondary by design: "Answer it" is the main path off a verdict, and the
// revision loop is what brings people back. This is the other thing you can
// do with an argument, not a competing call to action.
export function FindCounterpartButton({
  debateId,
  topicSlug,
  initialSeeking,
  existingExchangeId,
}: {
  debateId: string;
  topicSlug: string;
  initialSeeking: boolean;
  existingExchangeId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "waiting" | "error">(
    initialSeeking ? "waiting" : "idle"
  );

  async function seek() {
    setState("busy");
    track({ name: "counterpart_sought", props: { debate_id: debateId } });
    const result = await seekCounterpart(debateId);
    if (!result.ok) {
      setState("error");
      return;
    }
    if (result.exchangeId) {
      track({
        name: "counterpart_paired",
        props: { exchange_id: result.exchangeId, topic_slug: topicSlug },
      });
      router.push(`/counterpart/${result.exchangeId}`);
      return;
    }
    setState("waiting");
  }

  if (existingExchangeId) {
    return (
      <a
        href={`/counterpart/${existingExchangeId}`}
        className="text-sm font-medium text-ink-mid underline underline-offset-4 hover:text-ink"
      >
        Open your counterpart exchange
      </a>
    );
  }

  if (state === "waiting") {
    // No count and no ETA: both would be a number that only ever looks
    // discouraging on a product this size.
    return <span className="text-sm text-ink-soft">Waiting for a counterpart</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={seek}
        disabled={state === "busy"}
        className="min-h-11 rounded-md border border-rule bg-surface px-5 text-sm font-medium hover:border-ink-soft disabled:opacity-50"
      >
        {state === "busy" ? "Looking…" : "Find a counterpart"}
      </button>
      <p className="mt-2 font-sans text-sm text-ink-mid max-w-[52ch]">
        Someone who argued this motion from another school will see your argument and answer one
        claim in it. Nobody else sees it. Two replies each, then it closes.
      </p>
      {state === "error" && (
        <p className="mt-2 font-mono text-xs text-oxblood">Couldn&apos;t do that right now.</p>
      )}
    </div>
  );
}
