-- Clients keep only the table writes the site makes with them.
--
-- Supabase's default privileges give anon and authenticated every
-- privilege on every table made in `public`, and row level security is
-- then the only thing between the public anon key and a write. Six
-- policies on five tables, from early migrations, allowed more than the
-- site needs, and the site makes none of these writes with a client key:
-- every insert and update below goes through the server role, which row
-- level security does not apply to (src/app/actions.ts,
-- src/app/api/judge/route.ts, src/app/debate/actions.ts,
-- src/app/me/actions.ts, src/lib/claim.ts, src/lib/challenge.ts).
--
-- - debates: "debates insert own" let a signed-in user insert rows under
--   their own id with any verdict, score and rating, which debates_public
--   then shows on a public verdict page.
-- - profiles: "own update" has no column limit, so a signed-in user could
--   set their own rating, streak and school; "own insert" let a user with
--   no profile yet create one with any of them.
-- - challenges and quiz_results: "anon insert own" is with check (true),
--   so anyone holding the public key could insert any row. 0021 already
--   took the update policy off challenges.
-- - class_members: "member join self" let a signed-in user who knew a
--   class's id join it without its code and past the joining limit.
--
-- Found on 2026-11-03 and reported to Arthur that night; his "yes, the
-- grants fix" came on 2026-11-04, to a proposal that named INSERT, UPDATE
-- and DELETE on debates, challenges and quiz_results, UPDATE on profiles
-- limited to two columns, INSERT on class_members, and MAINTAIN on the
-- views. Beyond that wording, and put to him before applying: TRUNCATE,
-- REFERENCES and TRIGGER on the five tables; MAINTAIN on the five tables;
-- INSERT and DELETE on profiles (without the INSERT revoke a signed-in
-- user could create their own profile, with any rating, before the
-- server makes it); UPDATE on class_members; DELETE on class_members for
-- anon. The policies stay: without the grant a policy is never reached,
-- and dropping one is a second change to review.
--
-- What clients keep, each because the site uses it:
-- - SELECT on all five tables, under their existing read policies;
-- - UPDATE of profiles.display_name and profiles.argument_default_public,
--   for signed-in users (setDisplayName, setArgumentDefaultPublic);
-- - DELETE on class_members, for signed-in users (leaveClass, under
--   "member leave self").
-- reading_responses, which the site writes with the signed-in client
-- (saveReadingResponse), is not touched.
--
-- TRUNCATE, REFERENCES and TRIGGER go too: none is reachable through the
-- Data API, and the site uses none. On Postgres 17, as in production,
-- MAINTAIN goes from these tables and from the four public views, where
-- 0016 revoked the six privileges other than SELECT that Postgres 16 has,
-- and left it. Postgres 16 has no MAINTAIN, so that statement runs only
-- from 17 on.
--
-- A REVOKE that finds nothing it may revoke (a privilege granted by
-- another role) still succeeds, so the file ends by checking what anon
-- and authenticated actually hold, and fails, undoing all of it, if any
-- privilege meant to go is still there.
--
-- No row changes. Locks: REVOKE and GRANT are catalogue updates. They
-- take no lock on the tables' rows and wait for no reader or writer. No
-- transaction of its own: the Supabase runner wraps the file, and by hand
-- it is `psql --single-transaction`. The rollback,
-- supabase/rollback/0022_client_write_grants.down.sql, restores the
-- privileges, and scripts/test-0022-client-write-grants.sh runs both on a
-- throwaway local database.

revoke insert, update, delete, truncate, references, trigger
  on public.debates,
     public.challenges,
     public.quiz_results,
     public.profiles
  from anon, authenticated;

-- REVOKE takes column privileges of the same kind with it, so the column
-- grant comes after.
grant update (display_name, argument_default_public) on public.profiles to authenticated;

revoke insert, update, truncate, references, trigger
  on public.class_members
  from anon, authenticated;
revoke delete on public.class_members from anon;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on public.debates, public.challenges, public.quiz_results,'
         || ' public.profiles, public.class_members,'
         || ' public.debates_public, public.exchanges_public, public.profiles_public,'
         || ' public.public_results from anon, authenticated';
  end if;
end
$$;

do $$
declare
  t text;
  p text;
  r text;
  c text;
  left_over text[] := '{}';
  pg17 boolean := current_setting('server_version_num')::int >= 170000;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach t in array array['debates', 'challenges', 'quiz_results', 'profiles', 'class_members'] loop
      foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] || case when pg17 then array['MAINTAIN'] else '{}'::text[] end loop
        continue when t = 'class_members' and p = 'DELETE' and r = 'authenticated';
        if has_table_privilege(r, 'public.' || t, p) then left_over := left_over || (r || ' ' || p || ' on ' || t); end if;
      end loop;
    end loop;
    if pg17 then
      foreach t in array array['debates_public', 'exchanges_public', 'profiles_public', 'public_results'] loop
        if has_table_privilege(r, 'public.' || t, 'MAINTAIN') then left_over := left_over || (r || ' MAINTAIN on ' || t); end if;
      end loop;
    end if;
    for c in select attname from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped loop
      continue when r = 'authenticated' and c in ('display_name', 'argument_default_public');
      if has_column_privilege(r, 'public.profiles', c, 'UPDATE') then left_over := left_over || (r || ' UPDATE of profiles.' || c); end if;
    end loop;
  end loop;
  if cardinality(left_over) > 0 then
    raise exception '0022: still held after the revokes: %', array_to_string(left_over, ', ');
  end if;
end
$$;
