-- Phase 2c: /me's percentile. "count(elo < mine) / count(*) over profiles,
-- computed in a database function" per the brief. The 5-minute cache it
-- also asks for is an application-level cache around calling this
-- function (src/lib/percentile.ts), not anything inside the function
-- itself — Postgres functions don't have a built-in result cache.
create or replace function elo_percentile(user_elo numeric)
returns numeric
language sql
stable
as $$
  select case when (select count(*) from profiles) = 0 then 0
    else (select count(*) from profiles where elo < user_elo)::numeric
         / (select count(*) from profiles)::numeric
  end;
$$;
