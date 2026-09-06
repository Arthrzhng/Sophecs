"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignChallengeTopic } from "@/app/debate/actions";

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
      <Link
        href={`/login?next=${encodeURIComponent(`/r/${resultId}`)}`}
        className="inline-block bg-ink text-surface rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-85"
      >
        Debate them
      </Link>
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
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="inline-block bg-ink text-surface rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-85 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Debate them"}
      </button>
      {error && <p className="mt-2 font-mono text-xs text-oxblood">{error}</p>}
    </div>
  );
}
