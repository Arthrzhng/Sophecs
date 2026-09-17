"use client";

import { useEffect, useState } from "react";

// Confirmation of something that already happened — copied, saved, sent.
// Never an error: an error needs to stay on screen next to the thing that
// failed, and a toast that disappears is the wrong place for it.
//
// aria-live="polite" rather than "assertive": this never interrupts.
export function Toast({
  message,
  onDone,
  duration = 2600,
}: {
  message: string | null;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, duration);
    return () => clearTimeout(id);
  }, [message, duration, onDone]);

  return (
    <div role="status" aria-live="polite">
      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-rule bg-paper px-4 py-3 text-sm text-ink shadow-overlay">
          {message}
        </p>
      )}
    </div>
  );
}

// Small hook so a caller does not hand-roll the timer and the null state.
export function useToast(): [string | null, (m: string) => void, () => void] {
  const [message, setMessage] = useState<string | null>(null);
  return [message, setMessage, () => setMessage(null)];
}
