-- Undoes 0024_checkpoint_a_database.sql: every object back as it was
-- before it, read from production on 2026-11-05
-- (docs/seed-snapshots/2026-11-05-before-0024.json). The constraint drop
-- is a DROP, so this is Arthur's to run, in the SQL Editor.

set local lock_timeout = '5s';

-- 23.
grant select on public.exchanges_public to anon, authenticated;

-- 22. CREATE OR REPLACE sets the function's configuration from the new
-- definition, which has none; the reset makes that explicit.
create or replace function public.elo_percentile(user_elo numeric)
returns numeric
language sql
stable
as $$
  select case when (select count(*) from profiles where not is_sample) = 0 then 0
    else (select count(*) from profiles where not is_sample and elo < user_elo)::numeric
         / (select count(*) from profiles where not is_sample)::numeric
  end;
$$;
alter function public.elo_percentile(numeric) reset search_path;

-- 21. Before 0024 the functions were executable by authenticated, the
-- owner and service_role, and not by anon or PUBLIC.
grant execute on function public.is_class_member(text, uuid),
                          public.is_class_owner(text, uuid)
  to authenticated;

alter policy "member read own" on public.class_members
  rename to "member read own or owner";
alter policy "member read own or owner" on public.class_members
  using (auth.uid() = user_id or public.is_class_owner(class_id, auth.uid()));

alter policy "class read owner" on public.classes
  rename to "class read owner or member";
alter policy "class read owner or member" on public.classes
  using (auth.uid() = owner_id or public.is_class_member(id, auth.uid()));

-- 4.
alter table public.profiles drop constraint profiles_display_name_length;
