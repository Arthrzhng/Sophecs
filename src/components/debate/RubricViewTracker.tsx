"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

// The rubric page is static; this is the one client island on it, matching
// the CardViewTracker / DebateListViewTracker pattern.
export function RubricViewTracker() {
  useEffect(() => {
    track({ name: "rubric_viewed", props: {} });
  }, []);
  return null;
}
