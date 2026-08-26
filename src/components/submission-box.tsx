"use client";

import { useState } from "react";
import { submitArgument } from "@/app/actions";
import { SUBMISSION_MAX_CHARS } from "@/lib/types";

export function SubmissionBox({
  motionId,
  side,
}: {
  motionId: string;
  side: "for" | "against";
}) {
  const [body, setBody] = useState("");
  const remaining = SUBMISSION_MAX_CHARS - body.length;

  return (
    <form action={submitArgument}>
      <input type="hidden" name="motion_id" value={motionId} />
      <input type="hidden" name="side" value={side} />
      <label htmlFor="argument" className="eyebrow text-ink-soft block mb-3">
        Your argument · {side}
      </label>
      <textarea
        id="argument"
        name="body"
        value={body}
        onChange={(event) =>
          setBody(event.target.value.slice(0, SUBMISSION_MAX_CHARS))
        }
        rows={7}
        required
        placeholder="One argument, built to survive a reply. Cite what you can."
        className="w-full bg-surface border border-rule rounded-btn px-4 py-3 font-serif text-[17px] leading-relaxed resize-y placeholder:text-ink-soft placeholder:font-sans placeholder:text-sm"
      />
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`font-mono text-xs ${remaining < 60 ? "text-ink" : "text-ink-soft"}`}
        >
          {remaining} left
        </span>
        <button
          type="submit"
          disabled={body.trim().length === 0}
          className="bg-ink text-surface rounded-btn px-5 py-2.5 text-sm font-medium hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit for the round
        </button>
      </div>
    </form>
  );
}
