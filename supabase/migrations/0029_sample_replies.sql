-- Sample replies: one new kind of AI call, and the month's spend on them.
--
-- Arthur, 2026-11-08, item 1 (docs/decisions.md, "Sample replies: what is
-- logged"): when a reader argues with a sample account, one AI writes the
-- sample's side. "Same screening as human replies. Counts toward the
-- reader's daily cap and the monthly budget. Its own spending ceiling of
-- $15 a month inside the $50 budget."
--
-- The code that will make these calls is not on main when this is written:
-- it comes with the pull request that adds src/lib/sample-reply.ts (branch
-- `sample-replies`), behind its own flag, SAMPLE_REPLIES, off until it is
-- reviewed and tested. Each sample reply will make two calls, both logged
-- under the reader's user_id and with debate_id naming the sample's
-- argument:
-- - kind 'sample_reply', new here: the call that writes the reply;
-- - kind 'screen': its screening, the screen a reader's reply gets, logged
--   as one, so it counts toward the reader's daily cap wherever that cap
--   is counted (the counterpart turn route and the re-screening job count
--   kind 'screen' under the reader's user_id).
-- Both count toward the monthly budget with no change: ai_spend_since
-- (0026) totals every kind. ai_sample_spend_since totals the month's spend
-- on sample replies, for their own ceiling: every 'sample_reply' call, and
-- every 'screen' call made on a sample's argument (debate_id names a debate
-- marked is_sample, migration 0023; a reader's own screens log none). It
-- has the kinds written in, so no caller can pass a list that matches
-- nothing, and it refuses a null `since` rather than read it as nothing
-- spent.
--
-- The kind list is a check constraint, and a check constraint is widened
-- by dropping it and adding the wider one, in one transaction; nothing
-- else is dropped and no row is rewritten. The DROP takes ACCESS EXCLUSIVE
-- on ai_calls and holds it until the file commits: adding the check reads
-- every row once (one row in production on 2026-11-09), and the whole file
-- took about 40 ms on a local copy. While the lock is waited for, up to
-- lock_timeout, every read and write of ai_calls queues behind it; past
-- 5 s it gives up and changes nothing. No transaction of its own: the
-- Supabase runner wraps the file, the SQL Editor runs it as one, and by
-- hand it is `psql --single-transaction`. Run a second time, it stops at
-- `create function` and changes nothing: that error means it is already
-- applied. The rollback is supabase/rollback/0029_sample_replies.down.sql,
-- and scripts/test-0029-sample-replies.sh runs both on a throwaway
-- database.
set local lock_timeout = '5s';

alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist', 'screen', 'sample_reply'));

create function public.ai_sample_spend_since(since timestamptz)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
begin
  if since is null then
    raise exception 'ai_sample_spend_since: since is required';
  end if;
  return (
    select coalesce(sum(a.cost_usd), 0)
    from public.ai_calls a
    where a.created_at >= since
      and (
        a.kind = 'sample_reply'
        or (
          a.kind = 'screen'
          and a.debate_id is not null
          and exists (select 1 from public.debates d where d.id = a.debate_id and d.is_sample)
        )
      )
  );
end;
$$;

revoke execute on function public.ai_sample_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_sample_spend_since(timestamptz) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.ai_sample_spend_since(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.ai_sample_spend_since(timestamptz)', 'EXECUTE') then
    raise exception '0029: a client role can still execute ai_sample_spend_since';
  end if;
end
$$;
