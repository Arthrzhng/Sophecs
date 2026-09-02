"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics, track } from "@/lib/analytics/client";

const RETURN_VISIT_FLAG = "sophecs.return_visit.fired";

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 86_400_000);
}

// Mounted once in the root layout. Reads anon_id/anon_since from
// document.cookie rather than a server-side cookies() call, so the root
// layout — and any static page under it, like / — never gets forced into
// dynamic rendering just to bootstrap analytics. Initializes PostHog after
// first paint, fires return_visit when anon_id predates this session by
// more than a day, and fires page_viewed on every navigation.
export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const anonId = readCookie("anon_id");
    if (anonId) initAnalytics(anonId);
  }, []);

  useEffect(() => {
    const days = daysSince(readCookie("anon_since"));
    if (days < 1) return;
    try {
      if (sessionStorage.getItem(RETURN_VISIT_FLAG)) return;
      sessionStorage.setItem(RETURN_VISIT_FLAG, "1");
    } catch {
      // Private-mode storage failure — fire once per mount instead of
      // silently dropping the event.
    }
    track({ name: "return_visit", props: { days_since_first: days } });
  }, []);

  useEffect(() => {
    track({
      name: "page_viewed",
      props: {
        path: pathname,
        referrer: document.referrer,
        utm_source: searchParams.get("utm_source") ?? undefined,
        utm_medium: searchParams.get("utm_medium") ?? undefined,
        utm_campaign: searchParams.get("utm_campaign") ?? undefined,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
