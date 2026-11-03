-- profiles_public can no longer be read from the API.
--
-- Arthur's ruling of 2026-11-03, after 0016. The view lists every user's
-- id, handle, display name, school, Elo, streak and join date, and anyone
-- holding the public anon key could read it. Nothing reads it: no page,
-- script or test in the repository, and no view or function in the
-- database (checked before this was written; see docs/decisions.md). The
-- site promises that names are never shown.
--
-- The view is kept, so the admin client, which reads as service_role, can
-- still use it if a page ever needs it. Only anon and authenticated lose
-- SELECT; 0016 already took every other privilege from them.
--
-- Locks: a catalogue update, no lock on profiles. No transaction of its
-- own: the Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`.

revoke select on public.profiles_public from anon, authenticated;
