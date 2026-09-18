"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignChallengeTopic } from "@/app/debate/actions";
import { Button, ButtonLink } from "@/components/ui/Button";

export function DebateThemButton({
  challengeId,
  resultId,
  isSignedIn,
}: {
  challengeId: string;
  resultId: string;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <ButtonLink
        href={`/login?next=${encodeURIComponent(`/r/${resultId}`)}`}
      >
        Debate them
      </ButtonLink>
    );
  }

  async function start() {
    setPending(true);
    const result = await assignChallengeTopic(challengeId);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/debate/${result.topicSlug}?challenge=${challengeId}`);
  }

  return (
    <div>
      <Button
        onClick={start}
        disabled={pending}
      >
        {pending ? "Starting…" : "Debate them"}
      </Button>
      {error && <p className="mt-2 font-mono text-xs text-error">{error}</p>}
    </div>
  );
}
