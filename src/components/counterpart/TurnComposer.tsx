"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics/client";
import {
  MAX_QUOTE_CHARS,
  MAX_TURN_CHARS,
  MIN_QUOTE_CHARS,
  MIN_TURN_CHARS,
  checkQuote,
} from "@/lib/counterpart";

type Status =
  | { kind: "editing" }
  | { kind: "sending" }
  | { kind: "held" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

// The quote picker is a selection listener over the counterpart's text
// rather than a dropdown of pre-split sentences: sentence-splitting prose
// reliably is a hard problem and getting it wrong would stop someone
// quoting the clause they actually want to answer. Selecting text works on
// desktop; the same field stays editable so a phone can paste into it.
export function TurnComposer({
  exchangeId,
  seq,
  sourceLabel,
  sourceText,
}: {
  exchangeId: string;
  seq: number;
  sourceLabel: string;
  sourceText: string;
}) {
  const router = useRouter();
  const draftKey = `draft:turn:${exchangeId}:${seq}`;
  const [quote, setQuote] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { quote?: string; body?: string };
        if (parsed.quote) setQuote(parsed.quote);
        if (parsed.body) setBody(parsed.body);
      }
    } catch {
      // Best-effort only.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        if (quote || body) localStorage.setItem(draftKey, JSON.stringify({ quote, body }));
      } catch {
        // Best-effort only.
      }
    }, 2000);
    return () => clearInterval(id);
  }, [quote, body, draftKey]);

  // Picks up a selection made anywhere in the counterpart's text above.
  useEffect(() => {
    function onSelect() {
      const text = window.getSelection()?.toString() ?? "";
      const trimmed = text.trim();
      if (trimmed.length < MIN_QUOTE_CHARS || trimmed.length > MAX_QUOTE_CHARS) return;
      if (checkQuote(trimmed, sourceText) !== null) return;
      setQuote(trimmed);
    }
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [sourceText]);

  const quoteProblem = quote.trim() ? checkQuote(quote, sourceText) : null;
  const chars = body.trim().length;
  const canSend =
    quote.trim().length >= MIN_QUOTE_CHARS &&
    quoteProblem === null &&
    chars >= MIN_TURN_CHARS &&
    chars <= MAX_TURN_CHARS &&
    status.kind !== "sending";

  async function send() {
    if (!canSend) return;
    setStatus({ kind: "sending" });
    track({ name: "turn_submitted", props: { exchange_id: exchangeId, seq, chars } });

    let response: {
      ok: boolean;
      delivered?: boolean;
      complete?: boolean;
      held?: boolean;
      reason?: string;
      error?: string;
    };
    try {
      const res = await fetch("/api/counterpart/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeId, quotedClaim: quote.trim(), body: body.trim() }),
      });
      response = await res.json();
    } catch {
      setStatus({ kind: "error", message: "Couldn't send that. Your reply is still here." });
      return;
    }

    if (!response.ok) {
      setStatus({ kind: "error", message: response.error ?? "Couldn't send that." });
      return;
    }

    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Non-fatal.
    }

    if (response.held) {
      track({
        name: "turn_held",
        props: { exchange_id: exchangeId, reason: response.reason ?? "unknown" },
      });
      setStatus({ kind: "held" });
      return;
    }
    if (!response.delivered) {
      setStatus({ kind: "saved" });
      return;
    }
    if (response.complete) {
      track({ name: "exchange_completed", props: { exchange_id: exchangeId } });
    }
    router.refresh();
  }

  if (status.kind === "held") {
    return <p className="text-sm text-ink-mid">This reply was held for review.</p>;
  }
  if (status.kind === "saved") {
    return (
      <p className="text-sm text-ink-mid">
        Your reply is saved and will be delivered once it has been checked.
      </p>
    );
  }

  return (
    <div>
      <p className="eyebrow text-ink-soft mb-3">Your reply</p>
      <label htmlFor="quoted-claim" className="block font-sans text-sm text-ink-mid">
        Select a sentence in {sourceLabel} above, or paste it here.
      </label>
      <textarea
        id="quoted-claim"
        rows={2}
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        maxLength={MAX_QUOTE_CHARS}
        className="mt-2 w-full resize-none rounded-md border border-rule bg-surface p-3 font-serif text-base italic leading-relaxed"
      />
      {quoteProblem && (
        <p className="mt-1 font-mono text-xs text-oxblood">
          {quoteProblem === "not_found"
            ? "Quote the sentence you're answering."
            : quoteProblem === "too_short"
              ? `At least ${MIN_QUOTE_CHARS} characters.`
              : `At most ${MAX_QUOTE_CHARS} characters.`}
        </p>
      )}

      <label htmlFor="turn-body" className="mt-6 block font-sans text-sm text-ink-mid">
        Answer it.
      </label>
      <textarea
        id="turn-body"
        ref={bodyRef}
        rows={8}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-2 w-full rounded-md border border-rule bg-surface p-4 font-serif text-base leading-relaxed resize-y"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`font-mono text-xs ${
            chars > MAX_TURN_CHARS ? "text-oxblood" : "text-ink-soft"
          }`}
        >
          {chars} / {MAX_TURN_CHARS}
          {chars < MIN_TURN_CHARS && ` · ${MIN_TURN_CHARS} minimum`}
        </span>
        {status.kind === "error" && (
          <span className="font-mono text-xs text-oxblood">{status.message}</span>
        )}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="min-h-11 rounded-md bg-ink px-6 text-base font-medium text-surface hover:opacity-85 disabled:opacity-40"
        >
          {status.kind === "sending" ? "Sending…" : "Send reply"}
        </button>
      </div>
      <p className="mt-3 font-sans text-xs text-ink-soft max-w-[52ch]">
        Replies are checked before delivery. No names, schools, locations or links.
      </p>
    </div>
  );
}
