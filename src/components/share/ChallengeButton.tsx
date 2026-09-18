"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { createChallenge } from "@/app/actions";
import { track } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";

export function ChallengeButton({
  resultId,
  school,
  variant = "primary",
}: {
  resultId: string;
  school: SchoolId;
  variant?: ButtonVariant;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (state === "ready" && link) {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore — the link is still visible to copy by hand.
      }
      return;
    }
    setState("loading");
    const result = await createChallenge(resultId);
    if (!result.ok || !result.id) {
      setState("error");
      return;
    }
    const url = `https://sophecs.com/c/${result.id}`;
    setLink(url);
    setState("ready");
    track({ name: "challenge_created", props: { challenge_id: result.id, school } });
  }

  if (state === "error") {
    return <span className="text-sm text-ink-soft">Couldn&apos;t create a challenge link right now.</span>;
  }

  // One primary button per screen. Where "Debate them" is already present it
  // takes that role, and this drops to the bordered style rather than
  // disappearing — the challenge link is still the main way a result travels.
  return (
    <Button
      variant={variant}
      onClick={handleClick}
      loading={state === "loading"}
      loadingLabel="Creating…"
    >
      {state === "ready" ? (copied ? "Copied" : "Copy challenge link") : "Challenge a friend"}
    </Button>
  );
}
