"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignChallengeTopic } from "@/app/debate/actions";
import { ChunkyButton, ChunkyLink } from "@/components/daily-path/ChunkyButton";
import type { SchoolId } from "@/lib/types";

export function DebateThemButton({
  challengeId,
  resultId,
  isSignedIn,
  school,
}: {
  challengeId: string;
  resultId: string;
  isSignedIn: boolean;
  /** The result's school, so the primary action carries its colour. */
  school: SchoolId;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <ChunkyLink
        href={`/login?next=${encodeURIComponent(`/r/${resultId}`)}`}
        school={school}
      >
        Debate them
      </ChunkyLink>
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
      <ChunkyButton school={school} onClick={start} disabled={pending}>
        {pending ? "Starting…" : "Debate them"}
      </ChunkyButton>
      {error && <p className="mt-2 font-mono text-xs text-error">{error}</p>}
    </div>
  );
}
