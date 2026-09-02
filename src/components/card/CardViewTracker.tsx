"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import type { SchoolId } from "@/lib/types";

export function CardViewTracker({
  resultId,
  school,
  isOwner,
  referrer,
}: {
  resultId: string;
  school: SchoolId;
  isOwner: boolean;
  referrer: string;
}) {
  useEffect(() => {
    track({ name: "card_viewed", props: { result_id: resultId, school, is_owner: isOwner, referrer } });
    if (!isOwner) {
      track({ name: "share_page_viewed", props: { result_id: resultId, school, referrer } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId]);

  return null;
}
