"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";

const SITE = "https://sophecs.com";

// Native share where the OS has one, copy and download where it does not.
//
// Capability-detected at click time rather than by viewport width: a phone
// with a narrow window is still a phone, and a desktop browser that has
// navigator.share should get it. The desktop pair is rendered too, so the
// controls do not appear and disappear between devices.
export function ShareSheet({
  resultId,
  school,
  shareLine,
  shareLineIndex,
}: {
  resultId: string;
  school: SchoolId;
  shareLine: string;
  shareLineIndex: number;
}) {
  const [toast, showToast, clearToast] = useToast();
  const [busy, setBusy] = useState(false);
  const url = `${SITE}/r/${resultId}`;

  function log(channel: "native" | "copy" | "download") {
    track({
      name: "share_clicked",
      props: { result_id: resultId, school, channel, share_line: shareLineIndex },
    });
  }

  async function cardFile(): Promise<File | null> {
    try {
      const res = await fetch(`/r/${resultId}/card.png`);
      if (!res.ok) return null;
      return new File([await res.blob()], "sophecs-result.png", { type: "image/png" });
    } catch {
      return null;
    }
  }

  async function shareNative() {
    log("native");
    setBusy(true);
    const file = await cardFile();
    const data: ShareData & { files?: File[] } = { title: "Sophecs", text: shareLine, url };
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
    try {
      await navigator.share(data);
    } catch {
      // Cancelled. Not an error worth surfacing.
    }
    setBusy(false);
  }

  async function copyLink() {
    log("copy");
    try {
      await navigator.clipboard.writeText(`${shareLine} ${url}`);
      showToast("Copied.");
    } catch {
      showToast(url);
    }
  }

  async function downloadCard() {
    log("download");
    track({ name: "card_downloaded", props: { result_id: resultId } });
    setBusy(true);
    const file = await cardFile();
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "sophecs-result.png";
      a.click();
      URL.revokeObjectURL(blobUrl);
      showToast("Saved.");
    } else {
      showToast("Could not build the image. Try copying the link.");
    }
    setBusy(false);
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {canNativeShare && (
          <Button onClick={shareNative} loading={busy} loadingLabel="Sharing…">
            Share
          </Button>
        )}
        <Button variant={canNativeShare ? "secondary" : "primary"} onClick={copyLink}>
          Copy link
        </Button>
        <Button variant="secondary" onClick={downloadCard} loading={busy} loadingLabel="Saving…">
          Save image
        </Button>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
