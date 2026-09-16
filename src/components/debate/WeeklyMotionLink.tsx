"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/client";

// The only interactive part of the weekly section, so the rest of
// TopicList stays a server component.
export function WeeklyMotionLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/debate/${slug}`}
      className={className}
      onClick={() => track({ name: "weekly_motion_clicked", props: { topic_slug: slug } })}
    >
      {children}
    </Link>
  );
}
