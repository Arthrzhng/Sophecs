"use client";

import { useEffect, useState } from "react";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { useViewerId } from "@/components/lessons/useViewerId";
import { loadReached } from "@/lib/module-progress";

export interface LessonsCardModule {
  id: string;
  title: string;
  /** How many readings the module splits into. */
  readings: number;
}

/**
 * Where to pick the lessons up.
 *
 * The card names one module rather than describing the library, because a
 * reader who has read two of the three does not need telling what the
 * library is. Which one is the first in the index's own order that is not
 * finished, so "the next one" means the same thing on both screens.
 *
 * Progress is in browser storage (docs/daily-path-copy.md §10), so it is
 * unknown until the viewer is known and the effect has run. Until then the
 * card shows the first module as unstarted, which is what it is for a new
 * reader and what it settles to in a frame for everyone else. Showing
 * nothing would leave a hole in the sidebar on every load.
 *
 * The button is paper and not the school colour, in both states. The day's
 * one primary action is Start or Continue on the path beside this, and two
 * saturated buttons on one screen is two answers to "what now".
 */
export function LessonsCard({ modules }: { modules: LessonsCardModule[] }) {
  const viewerId = useViewerId();
  const [reached, setReached] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!viewerId) return;
    const next: Record<string, number> = {};
    for (const m of modules) next[m.id] = loadReached(viewerId, m.id);
    setReached(next);
  }, [viewerId, modules]);

  const next = modules.find((m) => (reached?.[m.id] ?? 0) < m.readings);
  const got = next ? reached?.[next.id] ?? 0 : 0;

  return (
    <section className="rounded-panel border-2 border-rule bg-surface p-5">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Lessons</p>

      {next ? (
        <>
          <p className="mt-2 max-w-[34ch] font-serif text-base leading-snug text-ink">
            {next.title}
          </p>
          <p className="mt-2 text-sm text-ink-mid">
            {got > 0 ? `Reading ${got} of ${next.readings}` : `${next.readings} readings`}
          </p>
          <p className="mt-4">
            <ChunkyLink
              href={`/lessons/modules/${next.id}`}
              tone="paper"
              className="w-full border-2 border-rule-strong"
            >
              Open lesson
            </ChunkyLink>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-mid">
            All three modules read.
          </p>
          <p className="mt-4">
            <ChunkyLink href="/lessons" tone="paper" className="w-full border-2 border-rule-strong">
              Browse lessons
            </ChunkyLink>
          </p>
        </>
      )}
    </section>
  );
}
