"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function MeViewTracker({
  pendingChallenges = 0,
  openObjections = 0,
}: {
  pendingChallenges?: number;
  openObjections?: number;
}) {
  useEffect(() => {
    track({
      name: "me_viewed",
      props: { pending_challenges: pendingChallenges, open_objections: openObjections },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
