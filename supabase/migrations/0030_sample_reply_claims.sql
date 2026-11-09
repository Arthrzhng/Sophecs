-- At most one sample reply in progress per reader.
--
-- Arthur, 2026-11-09, item 24 of the sample-accounts list: "At most one
-- sample reply in progress per reader at a time."
--
-- src/lib/sample-reply.ts claimed a sample's turn per exchange, by moving
-- the exchange's last_turn_at ahead. A reader with several exchanges with
-- samples could still have a reply being written in each at once, every
-- one passing the reader's daily room and the samples' ceiling before any
-- was logged. This makes the claim the reader's: one row per reader, taken
-- in one statement, so two requests for the same reader, for one exchange
-- or for two, cannot both hold it. It also leaves the exchange's
-- last_turn_at alone, so the lapse clock is no longer touched.
--
-- `claim_sample_reply` inserts the reader's row, or takes it over only if
-- the one there has expired, and returns whether it now holds the claim.
-- The primary key makes the insert and the takeover one step: of two
-- calls at once, one inserts and the other meets the conflict and finds
-- the row unexpired. Expiry is by the database's own clock, so the
-- clocks of different functions do not matter. A claim whose request died
-- runs out after `p_seconds`, which the code sets above its own time
-- limit; `release_sample_reply` gives one back, only with its own token.
--
-- Server role only: the table and both functions are revoked from the
-- client roles (Supabase's default privileges grant them), and that is
-- checked below. Security invoker, so they run with the caller's rights;
-- the server role bypasses row level security. Empty search_path, every
-- name qualified.
--
-- Additive: one table, two functions. The one lock on an existing table
-- is the foreign key's: creating it takes SHARE ROW EXCLUSIVE on
-- auth.users until the migration commits, which holds up writes there but
-- not reads, for the milliseconds the rest of this file takes;
-- `lock_timeout` makes it give up after five seconds rather than queue
-- behind a long transaction. A reader's claim goes with their account
-- (on delete cascade). The rollback,
-- supabase/rollback/0030_sample_reply_claims.down.sql, drops them;
-- scripts/test-0030-sample-reply-claims.sh runs both on a throwaway
-- database, with two sessions racing for one reader's claim.

set local lock_timeout = '5s';

create table public.sample_reply_claims (
  reader_id uuid primary key references auth.users (id) on delete cascade,
  exchange_id text not null,
  token text not null,
  expires_at timestamptz not null
);

alter table public.sample_reply_claims enable row level security;
revoke all on public.sample_reply_claims from public, anon, authenticated;

-- True when the call now holds the reader's claim, false when another
-- unexpired claim holds it. p_seconds outside 1 to 600 is refused.
create function public.claim_sample_reply(
  p_reader uuid,
  p_exchange text,
  p_token text,
  p_seconds integer
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_held boolean;
begin
  if p_seconds is null or p_seconds < 1 or p_seconds > 600 then
    raise exception 'claim_sample_reply: p_seconds must be between 1 and 600';
  end if;
  insert into public.sample_reply_claims as c (reader_id, exchange_id, token, expires_at)
  values (p_reader, p_exchange, p_token, now() + make_interval(secs => p_seconds))
  on conflict (reader_id) do update
    set exchange_id = excluded.exchange_id, token = excluded.token, expires_at = excluded.expires_at
    where c.expires_at <= now()
  returning true into v_held;
  return coalesce(v_held, false);
end;
$$;

create function public.release_sample_reply(p_reader uuid, p_token text)
returns void
language sql
volatile
set search_path = ''
as $$
  delete from public.sample_reply_claims where reader_id = p_reader and token = p_token;
$$;

revoke execute on function public.claim_sample_reply(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_sample_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_sample_reply(uuid, text, text, integer) to service_role;
grant execute on function public.release_sample_reply(uuid, text) to service_role;
-- What the code needs. Under Supabase's default privileges the server
-- role already holds all of them, and more; this states the minimum.
grant select, insert, update, delete on public.sample_reply_claims to service_role;

-- Every table privilege there is: Postgres 17, which production runs,
-- adds MAINTAIN to the seven of 16 (as 0022 found).
do $$
declare
  v_table_privs text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    || case when current_setting('server_version_num')::int >= 170000 then ',MAINTAIN' else '' end;
begin
  if has_function_privilege('anon', 'public.claim_sample_reply(uuid, text, text, integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.claim_sample_reply(uuid, text, text, integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.release_sample_reply(uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.release_sample_reply(uuid, text)', 'EXECUTE')
     or has_table_privilege('anon', 'public.sample_reply_claims', v_table_privs)
     or has_table_privilege('authenticated', 'public.sample_reply_claims', v_table_privs) then
    raise exception '0030: a client role can still reach sample_reply_claims or its functions';
  end if;
end
$$;
