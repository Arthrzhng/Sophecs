-- Sample replies: one new kind of AI call, a mark for the calls made for
-- a sample account, and this month's spend on them.
--
-- Arthur, 2026-11-08, item 1 (docs/decisions.md, "Sample replies: what is
-- logged"): when a reader argues with a sample account, one AI writes the
-- sample's side. "Same screening as human replies. Counts toward the
-- reader's daily cap and the monthly budget. Its own spending ceiling of
-- $15 a month inside the $50 budget."
--
-- The code that will make these calls is not on main when this is written:
-- it comes with the pull request that adds src/lib/sample-reply.ts (#117,
-- branch `sample-replies`), behind its own flag, SAMPLE_REPLIES, off until
-- it is reviewed and tested. Each sample reply will make two calls, both
-- logged under the reader's user_id and marked `for_sample`:
-- - kind 'sample_reply', new here: the call that writes the reply;
-- - kind 'screen': its screening, the screen a reader's reply gets, logged
--   as one, so it counts toward the reader's daily cap wherever that cap
--   is counted (the counterpart turn route and the re-screening job count
--   kind 'screen' under the reader's user_id).
-- Both count toward the monthly budget with no change: ai_spend_since
-- (0026) totals every kind. ai_sample_spend_this_month totals this UTC
-- month's `for_sample` calls, for the samples' own ceiling. It takes no
-- argument, so no caller can ask it about a period that holds nothing.
-- The mark is on the row itself, not reached through a sample's debate,
-- so no genuine row comes to depend on a sample row (migration 0023's
-- rule) and a teardown changes no month's total. A check holds the mark
-- to its two kinds, and a writing call to the mark. The code writes the
-- column only on a marked call, as it writes validation_error only when
-- there is one, so every other insert reads the same before this has run
-- and after its rollback.
--
-- The kind list is a check constraint, and a check constraint is widened
-- by dropping it and adding the wider one, in one transaction. Nothing
-- else is dropped and no row is rewritten: the new column's default is a
-- constant, a catalogue change; each of the two checks reads every row
-- once (one row in production on 2026-11-09); the function, the revoke
-- and the grant are catalogue changes. The DROP takes ACCESS EXCLUSIVE on
-- ai_calls and holds it until the file commits, a few milliseconds on a
-- local copy. While the lock is waited for, up to lock_timeout, every
-- read and write of ai_calls queues behind it; past 5 s it gives up and
-- changes nothing. No transaction of its own: the Supabase runner wraps
-- the file, the SQL Editor runs it as one, and by hand it is
-- `psql --single-transaction`. Run a second time, it stops at
-- `column "for_sample" of relation "ai_calls" already exists` and changes
-- nothing: that error means it is already applied. The rollback is supabase/rollback/0029_sample_replies.down.sql,
-- and scripts/test-0029-sample-replies.sh runs both on a throwaway
-- database.
set local lock_timeout = '5s';

alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist', 'screen', 'sample_reply'));

alter table public.ai_calls add column for_sample boolean not null default false;
alter table public.ai_calls add constraint ai_calls_for_sample_check
  check ((kind <> 'sample_reply' or for_sample) and (not for_sample or kind in ('sample_reply', 'screen')));

create function public.ai_sample_spend_this_month()
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_calls
  where for_sample
    and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
$$;

revoke execute on function public.ai_sample_spend_this_month() from public, anon, authenticated;
grant execute on function public.ai_sample_spend_this_month() to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.ai_sample_spend_this_month()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.ai_sample_spend_this_month()', 'EXECUTE') then
    raise exception '0029: a client role can still execute ai_sample_spend_this_month';
  end if;
end
$$;
