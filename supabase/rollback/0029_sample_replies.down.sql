-- Undoes 0029_sample_replies.sql. A DROP, so Arthur's to run, in the SQL
-- Editor. First turn SAMPLE_REPLIES off in Vercel and redeploy, or revert
-- the PR that added it, and confirm that deploy is Ready: without the
-- function, every ceiling check fails closed, so samples stop replying,
-- which is safe but says nothing about why.
--
-- The narrower kind list cannot be added back while a row has one of the
-- two new kinds, and those rows are spend that happened: this refuses
-- rather than delete them. Arthur decides what to do with them.
set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.ai_calls where kind in ('sample_reply', 'sample_screen')) then
    raise exception '0029 rollback: ai_calls has sample_reply or sample_screen rows; not removing them';
  end if;
end
$$;

drop function public.ai_spend_since_kinds(timestamptz, text[]);
alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist', 'screen'));
