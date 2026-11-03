-- The four public views are read-only from the API, and the two class
-- helpers cannot be called signed out.
--
-- Found on 2026-11-03 and applied the same day with Arthur's yes; see
-- docs/decisions.md, "The public views were writable". Supabase's default
-- privileges give anon and authenticated every privilege on anything made
-- in `public`, views included. Each of these views selects from one table
-- with plain columns, so Postgres treats it as updatable, and each is
-- owned by `postgres`, which bypasses row level security. Together that
-- let anyone holding the public anon key update or delete the rows behind
-- them through the Data API: debate scores, verdicts and Elo, profiles,
-- quiz results, exchanges. Nothing in the app writes through a view; every
-- caller in src/ only selects.
--
-- SELECT is left exactly as it was: the pages that read these views read
-- them signed out.
--
-- is_class_member and is_class_owner are SECURITY DEFINER helpers for the
-- class policies. Every page that reads `classes` or `class_members` does
-- so with the admin client or signed in, so revoking EXECUTE from anon
-- changes nothing a reader sees. Postgres grants EXECUTE to PUBLIC by
-- default, and anon inherits it, so PUBLIC is revoked as well, and the
-- roles that need it are granted it by name so the result does not rest on
-- grants made elsewhere.
--
-- Locks: REVOKE and GRANT are catalogue updates and take no lock on the
-- rows behind the views. No transaction of its own: the Supabase runner
-- wraps the file, and by hand it is `psql --single-transaction`.

revoke insert, update, delete, truncate, references, trigger
  on public.debates_public,
     public.exchanges_public,
     public.profiles_public,
     public.public_results
  from anon, authenticated;

revoke execute
  on function public.is_class_member(text, uuid),
              public.is_class_owner(text, uuid)
  from public, anon;

grant execute
  on function public.is_class_member(text, uuid),
              public.is_class_owner(text, uuid)
  to authenticated, service_role;
