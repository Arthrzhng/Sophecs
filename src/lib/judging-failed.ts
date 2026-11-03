// What a reader sees when a submission ends without a verdict: every reply
// failed validation after the two retries, or the judge's API failed.
// docs/daily-path-copy.md, "Judging failed". Arthur's ruling of 2026-11-03.
//
// Both sentences are true when shown, and the tests hold them so:
// /api/judge saves the argument on the debate row before it calls the
// judge, and refuses to call it when that save fails; judgeDebate takes a
// failed submission's calls out of the daily cap, and when that update
// fails, the route says so with `offCap: false` and the editor shows
// JUDGING_FAILED_BODY_COUNTED, which makes no claim about the cap.
//
// Shared by the route, which sends it as the error, and the editor, which
// shows it; nothing here is server-only.
export const JUDGING_FAILED_REASON = "judging_failed";
export const JUDGING_FAILED_TITLE = "Judging failed.";
export const JUDGING_FAILED_BODY =
  "This did not use one of today's arguments, and your argument is saved. Try again.";
// When the failed submission's calls could not be taken out of the cap.
export const JUDGING_FAILED_BODY_COUNTED = "Your argument is saved. Try again.";
// The detail line under the generic error when an earlier unjudged try's
// row could not take the new text, so nothing was sent: docs/daily-path-
// copy.md, "Judging failed". The generic body above it says the argument
// is saved in this browser, which stays true.
export const ARGUMENT_NOT_SAVED = "The new text could not be stored, so nothing was sent to the judge.";
