// Pure — deliberately free of `server-only`, because /quiz/result picks a
// share line on the client. The school content it needs is already passed to
// that component as a prop; only the choosing was trapped behind the
// filesystem-reading module.

// Deterministic rotation: the same result id always shows the same share
// line, so it's trackable and A/B-able in Phase 4.
export function pickShareLineFrom(
  lines: string[],
  resultId: string
): { text: string; index: number } {
  let hash = 0;
  for (let i = 0; i < resultId.length; i++) {
    hash = (hash * 31 + resultId.charCodeAt(i)) >>> 0;
  }
  const index = hash % lines.length;
  return { text: lines[index], index };
}
