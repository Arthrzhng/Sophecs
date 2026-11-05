-- Four of Arthur's rulings of 2026-11-05 on Checkpoint A, items 4, 21, 22
-- and 23 (docs/decisions.md, "Arthur's rulings of 2026-11-05 on
-- Checkpoint A"). Item 5, dropping the five policies 0022 made
-- unreachable, is a DROP and goes to Arthur for the SQL Editor, as its
-- own migration, 0025_drop_unreachable_policies.sql. Nothing here drops
-- anything.
--
-- 4. "display_name 60-char check constraint (verify existing rows
--    first)". Signed-in readers may update their own display_name through
--    the Data API (0022 kept that column grant for /me), which skips
--    setDisplayName's trim and 60-character limit. The check holds the
--    limit in the database. Rows checked in production on 2026-11-05
--    before writing this: 3,280 profiles, none over 60 characters (the
--    longest is 12; docs/seed-snapshots/2026-11-05-before-0024.json). char_length counts code
--    points; setDisplayName's limit counts UTF-16 units, which are never
--    fewer, so nothing the site writes can fail it.
--
-- 21. "Restrict is_class_member/is_class_owner if any signed-in path
--    doesn't need them." No signed-in path needs them. They exist only for
--    the two class read policies, and every class read in src/ uses the
--    server role, which row level security does not apply to. The one
--    signed-in class write, leaveClass, deletes the reader's own
--    class_members row; its WHERE reads the row, so the row must pass a
--    select policy, which "auth.uid() = user_id" alone does. So the two
--    read policies narrow to the reader's own rows (ALTER POLICY, no
--    drop), and the functions stop being executable by clients. The
--    functions themselves stay, unused; dropping them is a DROP for later.
--
-- 22. "fix elo_percentile's search_path". It ran with the caller's
--    search_path. It now runs with an empty one and names its table in
--    full. Same signature, logic and results; CREATE OR REPLACE keeps its
--    owner and grants.
--
-- 23. "If nothing reads exchanges_public, revoke its read access."
--    Nothing in src/ or scripts/ reads it, and in production nothing in
--    the database depends on it (pg_depend, read on 2026-11-05). Clients
--    lose SELECT; the server role keeps it.
--
-- Locks: ALTER POLICY takes ACCESS EXCLUSIVE on classes and on
-- class_members for the catalogue change; ADD CONSTRAINT, last, takes it
-- on profiles while it checks the rows (3,280, milliseconds), and every
-- lock is held to the end of the transaction. lock_timeout keeps any of
-- them from queueing behind a long reader and holding every read behind
-- it. It bounds each wait separately, so in the worst case reads of the
-- class tables wait about 15s, 5s for each of the three tables, before
-- the file fails and rolls back whole. CREATE OR REPLACE FUNCTION takes
-- ACCESS SHARE on profiles while it checks the body, which conflicts
-- only with ACCESS EXCLUSIVE; the constraint then upgrades that lock, so
-- a deadlock is possible in principle, and Postgres would end it by
-- rolling one side back. REVOKE takes no table lock. No
-- transaction of its own: the Supabase runner wraps the file, and by hand
-- it is `psql --single-transaction`. The rollback is
-- supabase/rollback/0024_checkpoint_a_database.down.sql, and
-- scripts/test-0024-checkpoint-a-database.sh runs both on a throwaway
-- local database.

set local lock_timeout = '5s';

-- 21.
alter policy "class read owner or member" on public.classes
  using (auth.uid() = owner_id);
alter policy "class read owner or member" on public.classes
  rename to "class read owner";

alter policy "member read own or owner" on public.class_members
  using (auth.uid() = user_id);
alter policy "member read own or owner" on public.class_members
  rename to "member read own";

revoke execute on function public.is_class_member(text, uuid),
                           public.is_class_owner(text, uuid)
  from public, anon, authenticated;

-- 22.
create or replace function public.elo_percentile(user_elo numeric)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when (select count(*) from public.profiles where not is_sample) = 0 then 0
    else (select count(*) from public.profiles where not is_sample and elo < user_elo)::numeric
         / (select count(*) from public.profiles where not is_sample)::numeric
  end;
$$;

-- 23.
revoke select on public.exchanges_public from anon, authenticated;

-- 4. Last, so ACCESS EXCLUSIVE on profiles, which most pages read, is held
-- only from here to the end of the file.
alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 60);

-- What clients hold afterwards, checked rather than assumed: a REVOKE that
-- finds nothing it may revoke (a privilege another role granted) still
-- succeeds. And no policy anywhere may still call either class function,
-- since a signed-in read of its table would then fail with "permission
-- denied for function".
do $$
declare
  left_over text[] := '{}';
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_function_privilege(r, 'public.is_class_member(text, uuid)', 'EXECUTE') then
      left_over := left_over || (r || ' EXECUTE on is_class_member');
    end if;
    if has_function_privilege(r, 'public.is_class_owner(text, uuid)', 'EXECUTE') then
      left_over := left_over || (r || ' EXECUTE on is_class_owner');
    end if;
    if has_table_privilege(r, 'public.exchanges_public', 'SELECT')
       or has_any_column_privilege(r, 'public.exchanges_public', 'SELECT') then
      left_over := left_over || (r || ' SELECT on exchanges_public');
    end if;
  end loop;
  if cardinality(left_over) > 0 then
    raise exception '0024: still held after the revokes: %', array_to_string(left_over, ', ');
  end if;
  select array_agg(pol.polrelid::regclass || ' "' || pol.polname || '"') into left_over
    from pg_depend d join pg_policy pol on pol.oid = d.objid
    where d.classid = 'pg_policy'::regclass
      and d.refclassid = 'pg_proc'::regclass
      and d.refobjid in ('public.is_class_member(text, uuid)'::regprocedure,
                         'public.is_class_owner(text, uuid)'::regprocedure);
  if cardinality(left_over) > 0 then
    raise exception '0024: policies still call the class functions: %', array_to_string(left_over, ', ');
  end if;
end
$$;
