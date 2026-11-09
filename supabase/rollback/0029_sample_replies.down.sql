-- Undoes 0029_sample_replies.sql. A DROP, so Arthur's to run, in the SQL
-- Editor.
--
-- Once a sample reply has been written, this cannot finish without
-- deleting spend that happened, and it refuses rather than delete it. So
-- after go-live the rollback will be the code's: turn SAMPLE_REPLIES off
-- in Vercel and redeploy, or revert the replies PR (#117, branch
-- `sample-replies`), and confirm that deploy is Ready. The wider check,
-- the column and the function do nothing on their own. Before any such
-- row exists (the flag never turned on), this drops the function, the
-- column and its check, and narrows the kind check back to the four kinds
-- 0012 left. The replies code writes the column only on a marked call,
-- so with the flag off every other insert is as before; without the
-- function, its every ceiling check will fail closed, so samples will
-- not reply.
set local lock_timeout = '5s';

-- Taken before the check, so no call can be written between the check
-- and the drops.
lock table public.ai_calls in share row exclusive mode;

do $$
begin
  if exists (select 1 from public.ai_calls where kind = 'sample_reply' or for_sample) then
    raise exception '0029 rollback: ai_calls has calls made for sample accounts; not removing them';
  end if;
end
$$;

drop function public.ai_sample_spend_this_month();
alter table public.ai_calls drop constraint ai_calls_for_sample_check;
alter table public.ai_calls drop column for_sample;
alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist', 'screen'));
