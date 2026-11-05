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
--    longest is 12), none blank or untrimmed. char_length counts code
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
--    full. Same signature, body and result; CREATE OR REPLACE keeps its
--    owner and grants.
--
-- 23. "If nothing reads exchanges_public, revoke its read access."
--    Nothing in src/ or scripts/ reads it, and in production nothing in
--    the database depends on it (pg_depend, read on 2026-11-05). Clients
--    lose SELECT; the server role keeps it.
--
-- Locks: ADD CONSTRAINT takes ACCESS EXCLUSIVE on profiles while it checks
-- the rows (3,280, milliseconds); ALTER POLICY takes ACCESS EXCLUSIVE on
-- classes and on class_members for the catalogue change. lock_timeout
-- keeps either from queueing behind a long reader and holding every read
-- behind it. REVOKE and CREATE OR REPLACE FUNCTION take no table lock. No
-- transaction of its own: the Supabase runner wraps the file, and by hand
-- it is `psql --single-transaction`. The rollback is
-- supabase/rollback/0024_checkpoint_a_database.down.sql, and
-- scripts/test-0024-checkpoint-a-database.sh runs both on a throwaway
-- local database.

set local lock_timeout = '5s';

-- 4.
alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 60);

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

-- What clients hold afterwards, checked rather than assumed: a REVOKE that
-- finds nothing it may revoke (a privilege another role granted) still
-- succeeds.
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
end
$$;
