"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PathNode } from "@/components/daily-path/PathNode";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SCHOOL_CHUNKY, shade } from "@/components/daily-path/chunky";
import { loadPicks, isCheckComplete } from "@/lib/reading-check-progress";
import {
  TODAY_STEPS,
  TODAY_SHIFTS,
  todayPathStates,
  todayDoneFlags,
  hasActionableStep,
} from "@/lib/today-path";
import type { SchoolId } from "@/lib/types";

export interface CaseProgress {
  read: boolean;
  argued: boolean;
  answered: boolean;
  closed: boolean;
}

export function TodayClient({
  slug,
  motionTitle,
  school,
  progress,
  paused,
  userId,
  passage,
  passageSource,
  children,
}: {
  slug: string;
  motionTitle: string;
  school: SchoolId;
  progress: CaseProgress;
  /** Judging is off for this reader: the same check /api/judge makes. */
  paused: boolean;
  userId: string;
  passage: string;
  passageSource: string;
  /** The sidebar cards, passed down as server-rendered children so they
      stay server components and add nothing to the client bundle. */
  children: ReactNode;
}) {
  // Step 2 lives in browser storage, so it is false until the effect runs.
  // That is the honest initial state rather than a guess, and it settles on
  // the first paint after mount.
  const [checked, setChecked] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);

  useEffect(() => {
    setChecked(isCheckComplete(loadPicks(userId, slug)));
  }, [userId, slug]);

  // The mapping and the lock rules are in @/lib/today-path, which is pure
  // and unit-tested: reaching steps 3 to 6 at all needs a judged argument,
  // so these states are close to impossible to click through by hand.
  const done = todayDoneFlags(progress, checked);
  const statuses = todayPathStates(done, paused);
  const firstOpen = done.findIndex((d) => !d);
  const allDone = firstOpen === -1;
  const canAct = hasActionableStep(statuses);
  const tone = SCHOOL_CHUNKY[school];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-ui px-6 py-10">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Today</h1>

        <section
          className="chunky mt-6 rounded-panel p-6 text-white"
          style={{ ...shade(tone.shade), background: tone.bg }}
        >
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-90">
            This week&apos;s motion
          </p>
          <p className="mt-2 max-w-[32ch] text-lg font-extrabold leading-tight">
            {motionTitle}
          </p>
          {passage && (
            <button
              type="button"
              aria-expanded={caseOpen}
              onClick={() => setCaseOpen((o) => !o)}
              className="chunky mt-5 inline-flex min-h-12 items-center rounded-chunky bg-surface px-5 text-sm font-extrabold tracking-wide uppercase text-ink"
              style={shade("var(--color-rule-strong)")}
            >
              {caseOpen ? "Hide the passage" : "Show the passage"}
            </button>
          )}
        </section>

        {/* "Show the passage", not "Read the case": step 1 is called "Read
            the case" and means the passage plus two written notes, so the
            toggle must not share its name for a strictly smaller thing.
            Shown in full rather than extracted, because choosing which part
            to show would be an editorial call on content this does not own. */}
        {passage && caseOpen && (
          <blockquote className="enter mt-5 rounded-card border-2 border-rule bg-surface p-6">
            <div className="prose-reading">
              {passage.split("\n\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <footer className="mt-4 text-sm text-ink-mid">{passageSource}</footer>
          </blockquote>
        )}

        <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {allDone ? (
              <div className="rounded-panel border-2 border-rule bg-surface p-6">
                <h2 className="text-lg font-extrabold tracking-tight text-ink">Case closed.</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-mid">
                  Next week&apos;s motion opens on Monday.
                </p>
                <p className="mt-4">
                  <Link
                    href="/debate"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
                  >
                    Argue another motion
                  </Link>
                </p>
              </div>
            ) : (
              canAct && (
                <div className="mb-8 flex justify-center">
                  <ChunkyLink href={`/debate/${slug}`} school={school}>
                    {firstOpen === 0 ? "Start" : "Continue"}
                  </ChunkyLink>
                </div>
              )
            )}

            <ol aria-label="This week's path" className="flex list-none flex-col items-center gap-7">
              {TODAY_STEPS.map((step, i) => {
                const { state, lockReason } = statuses[i];
                return (
                  <Fragment key={step.title}>
                    <PathNode
                      index={i}
                      title={step.title}
                      caption={step.caption}
                      state={state}
                      lockReason={lockReason}
                      school={school}
                      shift={TODAY_SHIFTS[i]}
                    />
                    {/* Said once, under step 2, rather than repeated on
                        each of the four nodes it applies to. A list item
                        rather than a sibling of the list, because it sits
                        between two steps and belongs to the path. */}
                    {i === 1 && paused && (
                      <li className="w-full max-w-[52ch] rounded-card border-2 border-rule bg-surface p-5">
                        <p className="text-base font-extrabold text-ink">Judging is paused.</p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-mid">
                          Judging is paused while we check the quality of the verdicts.
                          You can read the case and check your reading now. The last four
                          steps open when judging resumes.
                        </p>
                        <p className="mt-3 flex flex-wrap gap-5">
                          <Link
                            href="/method"
                            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
                          >
                            How the judge works
                          </Link>
                          <Link
                            href="/lessons"
                            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
                          >
                            Read the lessons
                          </Link>
                        </p>
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ol>
          </div>

          <aside className="flex w-full flex-col gap-4 lg:max-w-sm">{children}</aside>
        </div>
      </div>
    </main>
  );
}
