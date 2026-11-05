-- The monthly budget, totalled in the database.
--
-- Arthur's ruling of 2026-11-05 on Checkpoint A, item 7: "budget check
-- totals spend in the database and fails closed". src/lib/budget.ts read
-- every ai_calls row since the start of the month and added them up in
-- the server, which has two faults: a select with no range returns at
-- most one response's rows (Supabase's default is 1,000), so past that
-- the total undercounts; and it read a query error as zero spend. This
-- function returns the sum itself; budget.ts calls it and treats an error
-- as over budget (docs/decisions.md, "The judge's caps and budget").
--
-- The same rows as before: every ai_calls row since `since`, whatever its
-- kind. Security invoker, so it reads ai_calls with the caller's rights;
-- only the server role may call it, which row level security does not
-- apply to. Supabase's default privileges would let anon and
-- authenticated execute a new function, so that is revoked, and checked.
--
-- Additive: one new function, nothing else changes. No table lock. The
-- rollback, supabase/rollback/0026_ai_spend_since.down.sql, drops it, and
-- scripts/test-0026-ai-spend-since.sh runs both on a throwaway database.

create function public.ai_spend_since(since timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_calls where created_at >= since;
$$;

revoke execute on function public.ai_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_since(timestamptz) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.ai_spend_since(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.ai_spend_since(timestamptz)', 'EXECUTE') then
    raise exception '0026: a client role can still execute ai_spend_since';
  end if;
end
$$;
