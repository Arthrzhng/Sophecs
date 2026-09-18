"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";
import { Button } from "@/components/ui/Button";

const SITE = "https://sophecs.com";

interface Props {
  resultId: string;
  school: SchoolId;
  shareLine: string;
  shareLineIndex: number;
}

type Channel = "native" | "x" | "whatsapp" | "instagram" | "copy" | "download";

function useShare({ resultId, school, shareLine, shareLineIndex }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const url = `${SITE}/r/${resultId}`;

  function log(channel: Channel) {
    track({ name: "share_clicked", props: { result_id: resultId, school, channel, share_line: shareLineIndex } });
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function fetchCardFile(): Promise<File | null> {
    try {
      const res = await fetch(`/r/${resultId}/card.png`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], "sophecs-result.png", { type: "image/png" });
    } catch {
      return null;
    }
  }

  async function shareNative() {
    log("native");
    const file = await fetchCardFile();
    const shareData: ShareData & { files?: File[] } = { title: "Sophecs", text: shareLine, url };
    if (file && navigator.canShare?.({ files: [file] })) {
      shareData.files = [file];
    }
    try {
      await navigator.share(shareData);
    } catch {
      // User cancelled — not an error worth surfacing.
    }
  }

  function shareX() {
    log("x");
    const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareLine)}&url=${encodeURIComponent(url)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function shareWhatsApp() {
    log("whatsapp");
    const href = `https://wa.me/?text=${encodeURIComponent(`${shareLine} ${url}`)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  // Fires alongside share_clicked, not instead of it: share_clicked answers
  // "which channel did they pick", this answers "did the PNG actually leave
  // the site" — which is the number that matters for the card, and which
  // the Instagram path produces too.
  function logDownload() {
    track({ name: "card_downloaded", props: { result_id: resultId } });
  }

  async function shareInstagram() {
    log("instagram");
    const file = await fetchCardFile();
    if (file) {
      logDownload();
      const blobUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "sophecs-result.png";
      a.click();
      URL.revokeObjectURL(blobUrl);
    }
    try {
      await navigator.clipboard.writeText(`${shareLine} ${url}`);
    } catch {
      // Clipboard can be denied — the download still happened.
    }
    showToast("Card saved. Caption copied.");
  }

  async function copyLink() {
    log("copy");
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied.");
    } catch {
      showToast(url);
    }
  }

  function downloadCard() {
    log("download");
    logDownload();
    const a = document.createElement("a");
    a.href = `/r/${resultId}/card.png`;
    a.download = "sophecs-result.png";
    a.click();
  }

  return { toast, shareNative, shareX, shareWhatsApp, shareInstagram, copyLink, downloadCard };
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="secondary"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ShareRow(props: Props) {
  const share = useShare(props);
  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  return (
    <div>
      {/* Mobile: native share sheet first, then X, WhatsApp, Instagram, copy. */}
      <div className="flex sm:hidden flex-wrap gap-2">
        {canNativeShare && <Btn onClick={share.shareNative}>Share</Btn>}
        <Btn onClick={share.shareX}>X</Btn>
        <Btn onClick={share.shareWhatsApp}>WhatsApp</Btn>
        <Btn onClick={share.shareInstagram}>Instagram</Btn>
        <Btn onClick={share.copyLink}>Copy link</Btn>
      </div>

      {/* Desktop: X, copy link, download card. */}
      <div className="hidden sm:flex flex-wrap gap-2">
        <Btn onClick={share.shareX}>X</Btn>
        <Btn onClick={share.copyLink}>Copy link</Btn>
        <Btn onClick={share.downloadCard}>Download card</Btn>
      </div>

      {share.toast && (
        <p role="status" className="mt-3 font-mono text-xs text-ink-mid">
          {share.toast}
        </p>
      )}
    </div>
  );
}
