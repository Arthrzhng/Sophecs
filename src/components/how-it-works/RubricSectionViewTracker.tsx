"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

// rubric_viewed on /how-it-works (Arthur, 2026-11-06: "Count rubric_viewed
// when the rubric section of /how-it-works is viewed"). Once a page view,
// when the section reaches the upper half of the window; a link to
// #rubric lands it there at once. /debate/rubric, a page of its own, counts
// on load (RubricViewTracker), and the event is the same.

/** Calls `onSeen` once, the first time `el` reaches the window's upper half. */
export function watchSection(
  el: Element,
  onSeen: () => void,
  Observer: typeof IntersectionObserver = IntersectionObserver
): () => void {
  const observer = new Observer(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      onSeen();
    },
    { rootMargin: "0px 0px -50% 0px" }
  );
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * Watches the element with this id and calls `send` once it is seen; does
 * nothing where there is no such element or no IntersectionObserver.
 */
export function trackSection(
  id: string,
  send: () => void,
  doc: Pick<Document, "getElementById"> = document,
  Observer: typeof IntersectionObserver | undefined = typeof IntersectionObserver === "undefined"
    ? undefined
    : IntersectionObserver
): (() => void) | undefined {
  const el = doc.getElementById(id);
  if (!el || !Observer) return undefined;
  return watchSection(el, send, Observer);
}

export function RubricSectionViewTracker({ id }: { id: string }) {
  useEffect(() => trackSection(id, () => track({ name: "rubric_viewed", props: {} })), [id]);
  return null;
}
