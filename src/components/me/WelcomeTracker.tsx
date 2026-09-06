"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track, aliasToUser } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";

// Fires exactly once, right after a real sign-in completes (auth/callback
// appends ?welcome=1 only on that redirect) — then strips the param so a
// refresh of /me doesn't re-fire it. A server redirect can't reach
// posthog-js directly, which is why this can't just live in the route.
export function WelcomeTracker({
  active,
  userId,
  method,
  school,
  resultId,
}: {
  active: boolean;
  userId: string;
  method: "magic" | "google";
  school: SchoolId | null;
  resultId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    aliasToUser(userId);
    track({ name: "signup_completed", props: { method } });
    if (school && resultId) {
      track({ name: "result_claimed", props: { result_id: resultId, school } });
    }
    router.replace("/me", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return null;
}
