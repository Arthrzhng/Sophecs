"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
import { loadReached, progressAction, progressChip } from "@/lib/module-progress";
import { useViewerId } from "./useViewerId";
import type { SchoolId } from "@/lib/types";

export interface ModuleCard {
  id: string;
  school: SchoolId;
  title: string;
  excerpt: string;
  /** 1-based position among that school's modules. */
  numberInSchool: number;
  readings: number;
  /** The distinct authors, already joined. */
  sources: string;
}

type Filter = "all" | SchoolId;

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * The circle beside the progress chip.
 *
 * Three states, told apart by shape as well as fill: an empty ring, a ring
 * filled clockwise to the fraction read, and a solid disc with a tick. The
 * words beside it say the same thing, so the circle is decoration and is
 * hidden from assistive technology.
 */
function ProgressRing({ reached, total }: { reached: number; total: number }) {
  const done = total > 0 && reached >= total;
  if (done) {
    return (
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-correct text-white"
      >
        <Tick />
      </span>
    );
  }
  const fraction = total > 0 ? Math.max(0, Math.min(reached, total)) / total : 0;
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 shrink-0 rounded-full"
      style={{
        background:
          fraction > 0
            ? `conic-gradient(var(--color-correct) ${fraction * 360}deg, var(--color-rule) 0)`
            : "var(--color-rule)",
        // The hole, which is what makes it a ring rather than a pie.
        mask: "radial-gradient(circle, transparent 54%, black 55%)",
        WebkitMask: "radial-gradient(circle, transparent 54%, black 55%)",
      }}
    />
  );
}

/**
 * The module cards, filtered by school, under the index's own heading.
 *
 * The chips filter the modules and nothing else. The per-motion readings
 * below them are not filtered and are not filterable: a motion carries a
 * stance for all three schools, so its two passages belong to every school
 * at once, and assigning them one would invent a split the content
 * deliberately does not make.
 *
 * The heading comes in as a prop rather than sitting on the page above this,
 * because the mockup puts the chips on the heading's own baseline, to its
 * right, and the chips need the state that makes this a client component.
 */
export function ModuleFilter({
  heading,
  modules,
}: {
  heading: ReactNode;
  modules: ModuleCard[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const viewerId = useViewerId();
  const [reached, setReached] = useState<Record<string, number> | null>(null);

  // Read once the viewer is known, so one reader's place in a module is
  // never drawn for another. Until then the card shows no chip at all,
  // rather than "Not started" for someone who has read it.
  useEffect(() => {
    if (!viewerId) return;
    const next: Record<string, number> = {};
    for (const m of modules) next[m.id] = loadReached(viewerId, m.id);
    setReached(next);
  }, [viewerId, modules]);

  const shown = filter === "all" ? modules : modules.filter((m) => m.school === filter);

  // A chip for a school with no module would empty the list, which reads as
  // a fault rather than as a filter.
  const available = SCHOOLS.filter((s) => modules.some((m) => m.school === s));
  const chips: [Filter, string][] = [
    ["all", "All"],
    ...available.map((s) => [s, SCHOOL_COLORS[s].name] as [Filter, string]),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>{heading}</div>
        {available.length > 1 && (
          <div role="group" aria-label="Filter by school" className="flex flex-wrap gap-2">
            {chips.map(([value, label]) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(value)}
                  className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-bold ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-rule-strong bg-surface text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ul className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
        {shown.map((m) => {
          const tone = SCHOOL_CHUNKY[m.school];
          const got = reached?.[m.id] ?? 0;
          return (
            <li key={m.id} className="flex">
              <article
                className="chunky flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border-2 border-rule-strong bg-surface"
                style={shade("var(--color-rule-strong)")}
              >
                <p
                  className="px-5 py-4 text-xs font-extrabold tracking-widest uppercase text-white"
                  style={{ background: tone.bg }}
                >
                  {SCHOOL_COLORS[m.school].name} &middot; Module {m.numberInSchool}
                </p>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="font-serif text-lg font-medium leading-tight text-ink">
                    {m.title}
                  </h2>
                  <p className="text-sm text-ink-mid">
                    <span className="font-mono tabular">{m.readings}</span>{" "}
                    {m.readings === 1 ? "reading" : "readings"}
                    {m.sources && <> &middot; {m.sources}</>}
                  </p>
                  {/* The mockup's card has no excerpt. The line the index
                      already carries stays: it is the only description of
                      the module anywhere on this page. */}
                  <p className="text-sm leading-relaxed text-ink-mid">{m.excerpt}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                    {/* Held back until the viewer is known; the card is not
                        allowed to guess at someone's progress. */}
                    {reached ? (
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-mid">
                        <ProgressRing reached={got} total={m.readings} />
                        {progressChip(got, m.readings)}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Link
                      href={`/lessons/modules/${m.id}`}
                      aria-label={`${progressAction(got, m.readings)}: ${m.title}`}
                      className="chunky ml-auto inline-flex min-h-12 items-center rounded-chunky px-5 text-sm font-extrabold tracking-wide uppercase text-white"
                      style={{ ...shade(tone.shade), background: tone.bg }}
                    >
                      {progressAction(got, m.readings)}
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
