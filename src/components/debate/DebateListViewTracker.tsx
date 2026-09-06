"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function DebateListViewTracker() {
  useEffect(() => {
    track({ name: "debate_list_viewed", props: {} });
  }, []);
  return null;
}
