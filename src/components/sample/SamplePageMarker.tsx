"use client";

import { useEffect } from "react";
import { enterSamplePage } from "@/lib/analytics/client";

// Marks a page as showing a sample account's verdict, result or challenge,
// or sample arguments (the exemplars page),
// so the analytics client sends nothing from it (src/lib/analytics/client.ts,
// onSamplePage and fromSamplePage), and pauses session replay while it is
// open. Rendered once per such page, at the page level, never in a list.
// The attribute matches SAMPLE_PAGE_ATTRIBUTE there.
export function SamplePageMarker() {
  useEffect(() => enterSamplePage(window.location.pathname), []);
  return <div data-sophecs-sample-page="" hidden />;
}
