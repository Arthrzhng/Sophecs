-- Distinguishes a judge call made by a JUDGE_ALLOWLIST_USER_IDS reviewer
-- (bypassing the kill switch/daily cap) from an ordinary user's judged call.
alter table ai_calls drop constraint ai_calls_kind_check;
alter table ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist'));
