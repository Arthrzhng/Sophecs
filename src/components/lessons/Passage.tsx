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

/** One titled reading of a module. See src/lib/module-readings.ts. */
export interface PassageSection {
  id: string;
  title: string;
  paragraphs: string[];
}

/**
 * The reading view: a passage, its footnotes, and — for something long
 * enough to need them — a contents rail and a remembered position.
 *
 * Both of those are opt-in, and a micro-passage opts out of both. Four
 * paragraphs is one screen and a bit: a contents rail for it is a table of
 * contents for a page you can already see, and a remembered position
 * cannot restore anything you had not already reached. They are for
 * modules, which are long.
 *
 * Client-side only when it has to be. With neither prop this renders no
 * effects at all; the route stays static either way, since a client
 * component alone does not opt a page out of prerendering.
 */
export function Passage({
  className = "",
  storageKey,
  body = "",
  sections,
  onReadingInView,
  sources,
  rail,
  children,
}: {
  /** Spacing from whatever the page puts above the reading. */
  className?: string;
  /** Scroll position is remembered under this key. Omit to not remember. */
  storageKey?: string;
  /** One run of paragraphs. Ignored when `sections` is given. */
  body?: string;
  /** Titled readings, for a module. Each gets a heading and an anchor. */
  sections?: PassageSection[];
  /** Called with the 0-based reading the viewport is on. Needs `sections`. */
  onReadingInView?: (index: number) => void;
  sources: Source[];
  /** Omit for a passage short enough not to need one. */
  rail?: RailEntry[];
  /** Everything after the passage: sources, siblings, the arena link. */
  children?: React.ReactNode;
}) {
  const numbered = numberSources(sources);
  const paragraphs = body.split("\n\n");
  const article = useRef<HTMLDivElement>(null);
  const [restored, setRestored] = useState(false);
  const showRail = Boolean(rail && rail.length > 0);

  // Footnote markers number into the module's whole source list, so the
  // paragraphs of every reading are parsed against the same count.
  function renderParagraph(paragraph: string, key: number) {
    return (
      <p key={key}>
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
    );
  }

  // Restore where they stopped. Scoped by slug and to this browser: it is a
  // convenience, not state anyone else needs, so localStorage is the right
  // place and a failed read is a non-event.
  useEffect(() => {
    if (!storageKey) return;
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
    if (!storageKey) return;
    const id = setInterval(() => {
      try {
        localStorage.setItem(`read:${storageKey}`, String(Math.round(window.scrollY)));
      } catch {
        // Best-effort only.
      }
    }, 1500);
    return () => clearInterval(id);
  }, [storageKey]);

  // Which reading the viewport is on, for the bar above. Read straight off
  // the headings rather than from an observer's intersection flags: a
  // flag-based scrollspy has to special-case scrolling back up, and this is
  // correct in both directions by construction. Throttled to one frame, and
  // passive, so it never blocks the scroll.
  useEffect(() => {
    if (!sections || !onReadingInView) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = 0;
      sections.forEach((section, i) => {
        const el = document.getElementById(section.id);
        // 140px down from the top: a heading counts as reached once it is
        // comfortably on screen, not the instant its first pixel appears.
        if (el && el.getBoundingClientRect().top <= 140) current = i;
      });
      onReadingInView(current);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections, onReadingInView]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className={`${showRail ? "md:flex md:gap-10" : ""} ${className}`}>
      {/* The rail, from md up. Sticky, no border, no background — it is a
          list of links, and giving it a panel would make it furniture. */}
      {showRail && (
      <nav
        aria-label="On this page"
        data-print="hide"
        className="hidden md:block md:w-40 md:shrink-0"
      >
        {/* Clears the module bar pinned above it, which is ~68px tall. */}
        <div className="sticky top-24">
          <p className="text-sm text-ink-soft">On this page</p>
          <ul className="mt-2">
            {(rail ?? []).map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="inline-flex min-h-11 items-center text-sm text-ink-mid underline-offset-4 hover:text-ink hover:underline"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      )}

      <div className="min-w-0 flex-1">
        {/* Below md the rail is a native select, so the OS picker does the
            work a custom menu would do worse. */}
        {showRail && (
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
            className="mt-1 block min-h-11 w-full rounded-control border border-rule bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              Jump to…
            </option>
            {(rail ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        )}

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

        {sections ? (
          <div ref={article} className="mt-6">
            {sections.map((section, i) => (
              <section key={section.id} className={i > 0 ? "mt-12" : undefined}>
                {/* scroll-mt clears the heading of the bar pinned above it
                    when a rail link or the browser's own anchor jump lands
                    here. 96px: the bar is 68px on desktop and 86 at phone
                    width, where the counter needs a second line. */}
                <h2
                  id={section.id}
                  className="scroll-mt-24 text-lg font-extrabold tracking-tight text-ink"
                >
                  {section.title}
                </h2>
                <div className="prose-reading mt-4">
                  {section.paragraphs.map(renderParagraph)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div ref={article} id="passage" className="prose-reading mt-6 scroll-mt-8">
            {paragraphs.map(renderParagraph)}
          </div>
        )}

        <section id="sources" className="mt-12 scroll-mt-8 border-t border-rule pt-8">
          <h2 className="text-sm text-ink-soft">Sources</h2>
          <ol className="mt-3 space-y-2">
            {numbered.map((source) => (
              <li key={source.n} id={`source-${source.n}`} className="flex gap-3 text-sm">
                <span className="font-mono tabular text-ink-soft">{source.n}</span>
                <span className="text-ink-mid">
                  {formatSource(source)}
                  {/* Only where the passage quotes a translation verbatim.
                      Absent is absent: never a placeholder. */}
                  {source.translation && (
                    <span className="block text-ink-soft">
                      Translated by {source.translation}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {children}
      </div>
    </div>
  );
}
