"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

// pending_challenges is always 0 for now — surfacing them on /me is 2c.
export function MeViewTracker() {
  useEffect(() => {
    track({ name: "me_viewed", props: { pending_challenges: 0 } });
  }, []);
  return null;
}
