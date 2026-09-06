"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/client";

const SITE = "https://sophecs.com";

type Channel = "x" | "whatsapp" | "copy";

export function ShareRow({
  debateId,
  topicSlug,
  score,
  shareLine,
}: {
  debateId: string;
  topicSlug: string;
  score: number;
  shareLine: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const url = `${SITE}/debate/${topicSlug}/${debateId}`;

  function log(channel: Channel) {
    track({ name: "verdict_share_clicked", props: { debate_id: debateId, channel, score } });
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  function shareX() {
    log("x");
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareLine)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareWhatsApp() {
    log("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareLine)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    log("copy");
    try {
      await navigator.clipboard.writeText(shareLine);
      showToast("Copied.");
    } catch {
      showToast(url);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareX}
          className="min-h-11 px-4 rounded-md border border-rule bg-surface text-sm font-medium hover:border-ink-soft"
        >
          X
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          className="min-h-11 px-4 rounded-md border border-rule bg-surface text-sm font-medium hover:border-ink-soft"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="min-h-11 px-4 rounded-md border border-rule bg-surface text-sm font-medium hover:border-ink-soft"
        >
          Copy link
        </button>
      </div>
      {toast && (
        <p role="status" className="mt-3 font-mono text-xs text-ink-mid">
          {toast}
        </p>
      )}
    </div>
  );
}
