"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
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
 * right — and the chips need the state that makes this a client component.
 */
export function ModuleFilter({
  heading,
  modules,
}: {
  heading: ReactNode;
  modules: ModuleCard[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
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
                  {/* The mockup's card has no excerpt and a progress chip
                      instead. There is no progress store yet, so the line
                      the index already carries stays rather than the space
                      going empty. */}
                  <p className="text-sm leading-relaxed text-ink-mid">{m.excerpt}</p>
                  <div className="mt-auto flex justify-end pt-2">
                    <Link
                      href={`/lessons/modules/${m.id}`}
                      aria-label={`Start ${m.title}`}
                      className="chunky inline-flex min-h-12 items-center rounded-chunky px-5 text-sm font-extrabold tracking-wide uppercase text-white"
                      style={{ ...shade(tone.shade), background: tone.bg }}
                    >
                      Start
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
