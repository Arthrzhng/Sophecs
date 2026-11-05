-- The judge's daily cap and call ceiling, checked and claimed in one step.
--
-- Arthur's ruling of 2026-11-05 on Checkpoint B, (d) 1: "Yes: atomic
-- reservation for the ceiling and cap."
--
-- /api/judge counted a reader's judge calls in the last 24 hours and then
-- called the judge. Two submissions sent at the same moment both read the
-- same count, both passed, and both were judged: a reader at four of five
-- arguments could get six, and the 20-call ceiling could be passed by up
-- to two submissions' worth of calls. Each extra is bounded by the monthly
-- budget, but the cap is the promise.
--
-- `reserve_judge_submission` makes the check and the claim one step. It
-- takes a lock held for its own transaction and keyed by the reader, so
-- two calls for one reader run one after the other and calls for
-- different readers do not wait on each other. Under the lock it counts
-- what the route counted (the reader's `judge` rows in `ai_calls` in the
-- last 24 hours: those that count toward the cap, and all of them for the
-- ceiling) plus the submissions already reserved and not yet finished,
-- each counted as one argument and as the most calls one submission can
-- make. If the new one fits under both it is reserved, and the route
-- releases the reservation when the submission ends, judged or not.
--
-- A reservation the route never released (the function was killed
-- mid-call) expires on its own after `p_hold_seconds`, which the route
-- sets above its own time limit, and is deleted by the next reservation
-- for that reader. While a submission is in flight its own calls are in
-- `ai_calls` as well as its reservation, so for those seconds it counts
-- twice. That errs towards refusing, never towards an extra judgement,
-- and only for a reader with two submissions in flight at once.
--
-- Server role only: both functions and the table are revoked from the
-- client roles, and that is checked below. Security invoker, so they run
-- with the caller's rights; the server role bypasses row level security.
-- Empty search_path, every name qualified.
--
-- Additive: one table, two functions. No lock on an existing table. The
-- rollback, supabase/rollback/0028_judge_reservations.down.sql, drops
-- them; scripts/test-0028-judge-reservations.sh runs both on a throwaway
-- database, with two sessions racing for the last slot.

create table public.judge_reservations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index judge_reservations_user_expires_idx on public.judge_reservations (user_id, expires_at);

alter table public.judge_reservations enable row level security;
revoke all on public.judge_reservations from public, anon, authenticated;

-- Returns the reservation's id as text, or the reason it was refused:
-- 'daily_cap' or 'call_ceiling', the route's own words for its two
-- refusals.
create function public.reserve_judge_submission(
  p_user uuid,
  p_cap integer,
  p_ceiling integer,
  p_attempts integer,
  p_hold_seconds integer
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '24 hours';
  v_arguments integer;
  v_calls integer;
  v_held integer;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('sophecs.judge_reservation:' || p_user::text, 0));

  delete from public.judge_reservations where user_id = p_user and expires_at <= now();
  select count(*) into v_held from public.judge_reservations where user_id = p_user;

  select count(*) filter (where counts_toward_cap), count(*)
    into v_arguments, v_calls
    from public.ai_calls
   where user_id = p_user and kind = 'judge' and created_at >= v_since;

  if v_arguments + v_held >= p_cap then
    return 'daily_cap';
  end if;
  if v_calls + (v_held + 1) * p_attempts > p_ceiling then
    return 'call_ceiling';
  end if;

  insert into public.judge_reservations (user_id, expires_at)
  values (p_user, now() + make_interval(secs => p_hold_seconds))
  returning id into v_id;
  return v_id::text;
end;
$$;

create function public.release_judge_reservation(p_id bigint)
returns void
language sql
volatile
set search_path = ''
as $$
  delete from public.judge_reservations where id = p_id;
$$;

revoke execute on function public.reserve_judge_submission(uuid, integer, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.release_judge_reservation(bigint) from public, anon, authenticated;
grant execute on function public.reserve_judge_submission(uuid, integer, integer, integer, integer) to service_role;
grant execute on function public.release_judge_reservation(bigint) to service_role;
grant select, insert, delete on public.judge_reservations to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.reserve_judge_submission(uuid, integer, integer, integer, integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reserve_judge_submission(uuid, integer, integer, integer, integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.release_judge_reservation(bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.release_judge_reservation(bigint)', 'EXECUTE')
     or has_table_privilege('anon', 'public.judge_reservations', 'SELECT')
     or has_table_privilege('authenticated', 'public.judge_reservations', 'SELECT') then
    raise exception '0028: a client role can still reach judge_reservations or its functions';
  end if;
end
$$;
