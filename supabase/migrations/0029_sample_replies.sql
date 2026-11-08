-- Sample replies: two kinds of AI call, and their month's total.
--
-- Arthur, 2026-11-08, item 1: when a reader argues with a sample account,
-- one AI writes the sample's side. "Same screening as human replies.
-- Counts toward the reader's daily cap and the monthly budget. Its own
-- spending ceiling of $15 a month inside the $50 budget."
-- src/lib/sample-reply.ts makes two calls for each reply and logs both to
-- ai_calls, under the reader's user_id:
-- - sample_reply: the call that writes the sample's reply;
-- - sample_screen: the screening of that reply, the screen a reader's own
--   reply gets (src/lib/screen.ts), logged apart from a reader's own
--   screens so the ceiling can count it.
-- ai_spend_since (0026) already totals every kind, so both count toward the
-- monthly budget with no change there. ai_spend_since_kinds totals the
-- month's spend on the kinds named, for the ceiling; like ai_spend_since it
-- runs with the caller's rights and only the server role may call it.
--
-- The kind list is a check constraint, and a check constraint is widened
-- by dropping it and adding the wider one, in one transaction. Nothing
-- else is dropped and no row is rewritten: adding the check reads every
-- row once, and every existing kind is in the new list. ACCESS EXCLUSIVE
-- on ai_calls for that read, a few thousand rows. No transaction of its
-- own: the Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`, or the SQL Editor, which runs it as one.
-- The rollback is supabase/rollback/0029_sample_replies.down.sql, and
-- scripts/test-0029-sample-replies.sh runs both on a throwaway database.
set local lock_timeout = '5s';

alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge', 'golden', 'judge_allowlist', 'screen', 'sample_reply', 'sample_screen'));

create function public.ai_spend_since_kinds(since timestamptz, kinds text[])
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_calls where created_at >= since and kind = any(kinds);
$$;

revoke execute on function public.ai_spend_since_kinds(timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.ai_spend_since_kinds(timestamptz, text[]) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.ai_spend_since_kinds(timestamptz, text[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.ai_spend_since_kinds(timestamptz, text[])', 'EXECUTE') then
    raise exception '0029: a client role can still execute ai_spend_since_kinds';
  end if;
end
$$;
