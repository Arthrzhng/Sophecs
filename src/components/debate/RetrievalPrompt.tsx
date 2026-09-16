"use client";

import { useEffect, useRef, useState } from "react";
import { saveReadingResponse } from "@/app/debate/actions";
import { track } from "@/lib/analytics/client";
import { MAX_RETRIEVAL_RESPONSE_CHARS } from "@/lib/lesson-chunks";

// Recall, not assessment. Nothing here grades the answer, calls a model, or
// shows a correct response — the point is that writing the idea down once,
// from memory, is what makes the next screen easier. So there is no skip
// and no score, and the only failure state is a failure to save.
export function RetrievalPrompt({
  topicSlug,
  chunkIndex,
  prompt,
  initialValue,
  onSaved,
}: {
  topicSlug: string;
  chunkIndex: number;
  prompt: string;
  initialValue?: string;
  onSaved: (value: string) => void;
}) {
  const draftKey = `draft:reading:${topicSlug}:${chunkIndex}`;
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Same guarantee the argument editor gives: a tab discard or a failed
  // save never costs the words.
  useEffect(() => {
    if (initialValue) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setValue(saved);
    } catch {
      // Best-effort only.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-grow to three lines, then scroll. Measured off scrollHeight rather
  // than counting characters, which would be wrong at every viewport width.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * 3 + 24)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_RETRIEVAL_RESPONSE_CHARS && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(false);
    const result = await saveReadingResponse(topicSlug, chunkIndex, trimmed);
    if (!result.ok) {
      setError(true);
      setSaving(false);
      return;
    }
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Non-fatal.
    }
    track({
      name: "retrieval_prompt_answered",
      props: { topic_slug: topicSlug, chunk_index: chunkIndex, chars: trimmed.length },
    });
    onSaved(trimmed);
  }

  return (
    <div className="my-8 border-l-2 border-rule pl-4">
      <label htmlFor={`retrieval-${chunkIndex}`} className="block font-sans text-sm text-ink">
        {prompt}
      </label>
      <textarea
        id={`retrieval-${chunkIndex}`}
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_RETRIEVAL_RESPONSE_CHARS}
        onChange={(e) => {
          setValue(e.target.value);
          try {
            localStorage.setItem(draftKey, e.target.value);
          } catch {
            // Best-effort only.
          }
        }}
        className="mt-3 w-full resize-none overflow-y-auto rounded-md border border-rule bg-surface p-3 font-serif text-base leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-ink-soft">
          {trimmed.length} / {MAX_RETRIEVAL_RESPONSE_CHARS}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="min-h-11 rounded-md border border-rule bg-surface px-5 text-sm font-medium hover:border-ink-soft disabled:opacity-40"
        >
          {saving ? "Saving…" : "Keep going"}
        </button>
      </div>
      {error && (
        <p role="status" className="mt-2 font-mono text-xs text-oxblood">
          Couldn&apos;t save that. Your words are still here — try again.
        </p>
      )}
    </div>
  );
}
