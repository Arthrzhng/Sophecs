"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Passage, type PassageSection, type RailEntry } from "./Passage";
import { ReadingTopBar } from "./ReadingTopBar";
import { useViewerId } from "./useViewerId";
import { saveReached } from "@/lib/module-progress";
import type { Source } from "@/lib/footnotes";

/**
 * A module read as a sequence of titled readings.
 *
 * The bar names the reading the viewport is on, not a page: one module is
 * one page, and §10 asks for the count to follow the scroll. Progress is
 * recorded as the furthest reading reached, which is why scrolling back up
 * moves the bar but never the stored mark.
 */
export function ModuleReader({
  moduleId,
  schoolName,
  title,
  minutes,
  sections,
  sources,
  rail,
  children,
}: {
  moduleId: string;
  schoolName: string;
  title: string;
  minutes: number;
  sections: PassageSection[];
  sources: Source[];
  rail: RailEntry[];
  /** The motions this module prepares you for. */
  children?: ReactNode;
}) {
  const viewerId = useViewerId();
  const [current, setCurrent] = useState(0);

  // Stable, or Passage would tear down and rebuild its scroll listener on
  // every frame it reports.
  const onReadingInView = useCallback((index: number) => setCurrent(index), []);

  useEffect(() => {
    if (!viewerId) return;
    saveReached(viewerId, moduleId, current + 1);
  }, [viewerId, moduleId, current]);

  return (
    <main className="flex flex-1 flex-col">
      <ReadingTopBar
        width="ui"
        sticky
        position={{ index: current + 1, total: sections.length }}
      />

      <div className="mx-auto w-full max-w-ui flex-1 px-6 pb-12">
        <article className="rounded-panel border-2 border-rule bg-surface p-6 sm:p-10">
          <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
            {schoolName}
          </p>
          <h1 className="mt-3 max-w-[30ch] font-serif text-xl font-medium leading-tight text-ink">
            {title}
          </h1>
          <p className="mt-3 text-sm text-ink-mid">
            <span className="font-mono tabular">{minutes}</span> min
          </p>

          <Passage
            className="mt-8"
            storageKey={`module:${moduleId}`}
            sections={sections}
            onReadingInView={onReadingInView}
            sources={sources}
            rail={rail}
          >
            {children}
          </Passage>
        </article>
      </div>
    </main>
  );
}
