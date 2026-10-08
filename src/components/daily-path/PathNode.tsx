import type { CSSProperties } from "react";
import type { SchoolId } from "@/lib/types";
import { SCHOOL_CHUNKY, shade } from "./chunky";

export type PathNodeState = "done" | "current" | "locked";

/** Why a node is locked, which decides what the reader is told. */
export type LockReason = "order" | "judging";

function Tick() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Padlock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * One step on the week's path.
 *
 * Always a real <button>, including when locked: a locked step is
 * `disabled`, so it keeps its accessible name and stays in the reading
 * order rather than vanishing for a screen-reader user who is counting six
 * steps. The state is in the accessible name, not only in the colour and
 * the glyph, which is also why done shows a tick and locked a padlock
 * rather than the two differing by fill alone.
 *
 * The node is 78x72, comfortably past the 44px floor. The horizontal offset
 * that makes the column snake is a custom property so it can be scaled down
 * at phone width in CSS rather than recomputed here.
 */
export function PathNode({
  index,
  title,
  caption,
  state,
  lockReason = "order",
  school,
  shift = 0,
  onClick,
}: {
  /** 0-based position, so the visible number is index + 1. */
  index: number;
  title: string;
  caption: string;
  state: PathNodeState;
  lockReason?: LockReason;
  school: SchoolId;
  shift?: number;
  onClick?: () => void;
}) {
  const locked = state === "locked";
  const schoolTone = SCHOOL_CHUNKY[school];

  const face =
    state === "done"
      ? { bg: "var(--color-step-done)", sh: "var(--color-step-done-deep)", fg: "#ffffff" }
      : locked
        ? { bg: "var(--color-rule)", sh: "var(--color-rule-strong)", fg: "var(--color-ink-soft)" }
        : { bg: schoolTone.bg, sh: schoolTone.shade, fg: "#ffffff" };

  const statusText =
    state === "done"
      ? "Done"
      : state === "current"
        ? "Up next"
        : lockReason === "judging"
          ? "Waiting for judging"
          : `After step ${index}`;

  return (
    <li
      className="dp-node flex flex-col items-center gap-2.5"
      style={{ "--shift": `${shift}px` } as CSSProperties}
    >
      {state === "current" && (
        <span className="bob rounded-chunky border-2 border-rule-strong bg-surface px-3.5 py-2 text-xs font-extrabold tracking-widest uppercase"
          style={{ color: schoolTone.bg }}>
          Up next
        </span>
      )}

      <span className="relative inline-flex">
        {state === "current" && (
          <span
            aria-hidden="true"
            className="ring pointer-events-none absolute -inset-1.5 rounded-full border-4"
            style={{ borderColor: schoolTone.bg }}
          />
        )}
        <button
          type="button"
          disabled={locked}
          onClick={onClick}
          aria-label={`Step ${index + 1}, ${title}, ${statusText}`}
          style={{ ...shade(face.sh), background: face.bg, color: face.fg }}
          className="chunky relative inline-flex h-18 w-20 items-center justify-center rounded-full text-lg font-extrabold disabled:cursor-not-allowed"
        >
          {state === "done" ? <Tick /> : locked ? <Padlock /> : <span>{index + 1}</span>}
        </button>
      </span>

      <span className={`text-center text-base font-bold ${locked ? "text-ink-soft" : "text-ink"}`}>
        {title}
      </span>
      <span className="max-w-[26ch] text-center text-sm text-ink-mid">{caption}</span>
    </li>
  );
}
