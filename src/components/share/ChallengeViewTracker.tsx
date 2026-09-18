"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function ChallengeViewTracker({ challengeId }: { challengeId: string }) {
  useEffect(() => {
    track({ name: "challenge_viewed", props: { challenge_id: challengeId } });
  }, [challengeId]);
  return null;
}
