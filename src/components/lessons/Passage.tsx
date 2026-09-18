"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatSource,
  numberSources,
  parseFootnotes,
  type Source,
} from "@/lib/footnotes";

export interface RailEntry {
  id: string;
  label: string;
}

/**
 * The reading view: a passage, its footnotes, a contents rail and a
 * remembered position.
 *
 * Client-side because of the last of those. It costs the route its static
 * prerender, which is why the *page* stays a server component and only this
 * subtree is a client one — the title, the sources and the links around it
 * are all still server-rendered HTML.
 */
export function Passage({
  storageKey,
  body,
  sources,
  rail,
  children,
}: {
  /** Scroll position is remembered under this key. */
  storageKey: string;
  body: string;
  sources: Source[];
  rail: RailEntry[];
  /** Everything after the passage: sources, siblings, the arena link. */
  children?: React.ReactNode;
}) {
  const numbered = numberSources(sources);
  const paragraphs = body.split("\n\n");
  const article = useRef<HTMLDivElement>(null);
  const [restored, setRestored] = useState(false);

  // Restore where they stopped. Scoped by slug and to this browser: it is a
  // convenience, not state anyone else needs, so localStorage is the right
  // place and a failed read is a non-event.
  useEffect(() => {
    let y = 0;
    try {
      y = Number(localStorage.getItem(`read:${storageKey}`) ?? 0);
    } catch {
      y = 0;
    }
    // Only restore a position worth restoring. Sending someone back to 40px
    // down the page is worse than leaving them at the top.
    if (y > 200) {
      window.scrollTo({ top: y, behavior: "auto" });
      setRestored(true);
    }
  }, [storageKey]);

  // Saved on a timer rather than on every scroll event: the value only has
  // to be roughly right, and a listener that writes to localStorage on each
  // frame is the kind of thing that makes a page feel heavy.
  useEffect(() => {
    const id = setInterval(() => {
      try {
        localStorage.setItem(`read:${storageKey}`, String(Math.round(window.scrollY)));
      } catch {
        // Best-effort only.
      }
    }, 1500);
    return () => clearInterval(id);
  }, [storageKey]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="md:flex md:gap-10">
      {/* The rail, from md up. Sticky, no border, no background — it is a
          list of links, and giving it a panel would make it furniture. */}
      <nav
        aria-label="On this page"
        data-print="hide"
        className="hidden md:block md:w-40 md:shrink-0"
      >
        <div className="sticky top-8">
          <p className="text-sm text-ink-soft">On this page</p>
          <ul className="mt-3 space-y-2">
            {rail.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="text-sm text-ink-mid underline-offset-4 hover:text-ink hover:underline"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {/* Below md the rail is a native select, so the OS picker does the
            work a custom menu would do worse. */}
        <div className="md:hidden" data-print="hide">
          <label htmlFor="passage-rail" className="text-sm text-ink-soft">
            On this page
          </label>
          <select
            id="passage-rail"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) jump(e.target.value);
              e.target.value = "";
            }}
            className="mt-1 block w-full rounded-control border border-rule bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              Jump to…
            </option>
            {rail.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        {restored && (
          <p className="mt-4 text-sm text-ink-soft" data-print="hide">
            Picked up where you stopped reading.{" "}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0 })}
              className="text-ink underline underline-offset-4 hover:text-ink-mid"
            >
              Back to the start
            </button>
          </p>
        )}

        <div ref={article} id="passage" className="prose-reading mt-6 scroll-mt-8">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>
              {parseFootnotes(paragraph, numbered.length).map((piece, j) =>
                "note" in piece ? (
                  <sup key={j}>
                    <a
                      href={`#source-${piece.note}`}
                      id={`ref-${piece.note}`}
                      aria-label={`Footnote ${piece.note}`}
                      className="px-px text-ink-mid no-underline hover:text-ink"
                    >
                      {piece.note}
                    </a>
                  </sup>
                ) : (
                  <span key={j}>{piece.text}</span>
                )
              )}
            </p>
          ))}
        </div>

        <section id="sources" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
          <h2 className="text-sm text-ink-soft">Sources</h2>
          <ol className="mt-3 space-y-2">
            {numbered.map((source) => (
              <li key={source.n} id={`source-${source.n}`} className="flex gap-3 text-sm">
                <span className="font-mono tabular text-ink-soft">{source.n}</span>
                <span className="text-ink-mid">{formatSource(source)}</span>
              </li>
            ))}
          </ol>
        </section>

        {children}
      </div>
    </div>
  );
}
