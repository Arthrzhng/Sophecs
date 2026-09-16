"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function ClassViewTracker({ classId, members }: { classId: string; members: number }) {
  useEffect(() => {
    track({ name: "class_viewed", props: { class_id: classId, members } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
