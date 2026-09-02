"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function ChallengeViewTracker({ challengeId }: { challengeId: string }) {
  useEffect(() => {
    track({ name: "challenge_viewed", props: { challenge_id: challengeId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);
  return null;
}
