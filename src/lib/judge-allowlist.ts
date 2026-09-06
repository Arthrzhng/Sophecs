// Shared by /api/judge (bypasses kill switch/daily cap) and
// /debate/[slug]/page.tsx (suppresses analytics for these calls
// client-side) so the two can't drift on who's allowlisted.
export function isJudgeAllowlisted(userId: string): boolean {
  const ids = (process.env.JUDGE_ALLOWLIST_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
