"use client";

import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
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
  const [toast, showToast, clearToast] = useToast();
  const url = `${SITE}/debate/${topicSlug}/${debateId}`;

  function log(channel: Channel) {
    track({ name: "verdict_share_clicked", props: { debate_id: debateId, channel, score } });
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
      <p className="mb-4 text-sm text-ink-soft">Share this verdict</p>
      {/* No saturated surface here. The result card is the one place the
          product shouts; a verdict is a mark, and a mark is quiet. */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={shareX}>
          X
        </Button>
        <Button variant="secondary" onClick={shareWhatsApp}>
          WhatsApp
        </Button>
        <Button variant="secondary" onClick={copyLink}>
          Copy link
        </Button>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
