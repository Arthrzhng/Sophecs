// What a reader sees when a submission ends without a verdict: every reply
// failed validation after the two retries, or the judge's API failed.
// docs/daily-path-copy.md, "Judging failed". Arthur's ruling of 2026-11-03.
//
// Both sentences are true by construction, and the tests hold them so:
// /api/judge writes the debate row before it calls the judge, and
// judgeDebate takes a failed submission's calls out of the daily cap.
//
// Shared by the route, which sends it as the error, and the editor, which
// shows it; nothing here is server-only.
export const JUDGING_FAILED_REASON = "judging_failed";
export const JUDGING_FAILED_TITLE = "Judging failed.";
export const JUDGING_FAILED_BODY =
  "This did not use one of today's arguments, and your argument is saved. Try again.";
