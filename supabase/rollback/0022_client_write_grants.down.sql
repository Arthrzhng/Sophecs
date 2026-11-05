-- Rolls back 0022 by giving anon and authenticated back every privilege
-- on the five tables, as Supabase's default privileges made them, and
-- MAINTAIN on the four public views (Postgres 17 only). That reopens the
-- writes 0022 closed: run it only to undo 0022, with the reason written
-- down. No row changes.
--
-- The column grant on profiles goes first: GRANT ALL at table level would
-- leave it standing beside the table privilege, and the before-state had
-- none. scripts/test-0022-client-write-grants.sh checks that each object's
-- ACL after this file is the one it had before 0022.

revoke update (display_name, argument_default_public) on public.profiles from authenticated;

grant all
  on public.debates,
     public.challenges,
     public.quiz_results,
     public.profiles,
     public.class_members
  to anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'grant maintain on public.debates_public, public.exchanges_public,'
         || ' public.profiles_public, public.public_results to anon, authenticated';
  end if;
end
$$;
