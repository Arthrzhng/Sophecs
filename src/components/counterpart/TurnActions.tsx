"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blockCounterpart, reportTurn } from "@/app/debate/actions";
import { track } from "@/lib/analytics/client";

const REASONS = [
  { value: "harassment", label: "Harassment" },
  { value: "personal_info", label: "Personal information" },
  { value: "off_topic", label: "Off topic" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
] as const;

// Report and Block on every reply, as text links rather than icons — an
// unlabelled icon is exactly the thing a 15-year-old will not find when
// they need it.
export function TurnActions({ turnId, exchangeId }: { turnId: string; exchangeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("harassment");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitReport() {
    setBusy(true);
    const result = await reportTurn(turnId, reason, note);
    setBusy(false);
    if (result.ok) {
      track({ name: "turn_reported", props: { turn_id: turnId, reason } });
      setDone(true);
      setOpen(false);
    }
  }

  async function block() {
    // One confirmation, and it says what blocking actually costs — this is
    // not undoable from the UI.
    if (!window.confirm("Blocking ends this exchange and you won't be paired again. Continue?")) {
      return;
    }
    setBusy(true);
    const result = await blockCounterpart(exchangeId);
    setBusy(false);
    if (result.ok) {
      track({ name: "exchange_blocked", props: { exchange_id: exchangeId } });
      router.refresh();
    }
  }

  if (done) {
    return <p className="mt-2 font-mono text-xs text-ink-soft">Reported. We&apos;ll look at it.</p>;
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-xs text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Report
        </button>
        <button
          type="button"
          onClick={block}
          disabled={busy}
          className="font-mono text-xs text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          Block
        </button>
      </div>

      {open && (
        <div className="mt-3 border-l-2 border-rule pl-4">
          <fieldset>
            <legend className="font-sans text-sm text-ink-mid">What&apos;s wrong with it?</legend>
            <div className="mt-2 space-y-1">
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`report-${turnId}`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <textarea
            rows={2}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else worth knowing (optional)"
            className="mt-3 w-full resize-none rounded-md border border-rule bg-surface p-3 font-sans text-sm"
          />
          <button
            type="button"
            onClick={submitReport}
            disabled={busy}
            className="mt-3 min-h-11 rounded-md border border-rule bg-surface px-5 text-sm font-medium hover:border-ink-soft disabled:opacity-50"
          >
            Send report
          </button>
        </div>
      )}
    </div>
  );
}
