/**
 * How far through a module a reader has got.
 *
 * Browser storage, not the server, per docs/daily-path-copy.md §10: the same
 * trade the reading check makes. No migration, no write path, and the cost
 * recorded there is that progress does not follow a reader across devices.
 *
 * Keyed by viewer as well as module for the same reason the check's picks
 * are: two people on one browser must not see each other's progress. A
 * signed-out reader is "anon".
 */
export function moduleProgressKey(viewerId: string, moduleId: string): string {
  return `module:${viewerId}:${moduleId}`;
}

/** 1-based number of the furthest reading reached; 0 when none has been. */
export function loadReached(viewerId: string, moduleId: string): number {
  try {
    const raw = localStorage.getItem(moduleProgressKey(viewerId, moduleId));
    if (!raw) return 0;
    const n = Number(raw);
    // A hand-edited or stale value degrades to "not started" rather than to
    // a reading number that may no longer exist.
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a reading as reached. Only ever raises the mark: scrolling back up
 * through a module is re-reading, not un-reading.
 *
 * Returns what is now stored, so a caller can update its own state without a
 * second read.
 */
export function saveReached(viewerId: string, moduleId: string, reading: number): number {
  const current = loadReached(viewerId, moduleId);
  if (!Number.isInteger(reading) || reading <= current) return current;
  try {
    localStorage.setItem(moduleProgressKey(viewerId, moduleId), String(reading));
  } catch {
    // Storage unavailable. The module still reads; it just will not be
    // remembered, which is better than failing the page.
  }
  return reading;
}

/** The card's progress chip. §10. */
export function progressChip(reached: number, total: number): string {
  if (total <= 0 || reached <= 0) return "Not started";
  if (reached >= total) return "Read";
  return `Reading ${reached} of ${total}`;
}

/** The card's button. §10. */
export function progressAction(reached: number, total: number): "Start" | "Continue" | "Read again" {
  if (total <= 0 || reached <= 0) return "Start";
  if (reached >= total) return "Read again";
  return "Continue";
}
