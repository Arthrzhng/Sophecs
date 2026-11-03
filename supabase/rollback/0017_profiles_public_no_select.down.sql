-- Rolls back 0017 by restoring SELECT on profiles_public to anon and
-- authenticated, as it stood before (docs/seed-snapshots/
-- 2026-11-03-public-view-grants.json).
--
-- This makes every user's handle and display name readable again to anyone
-- with the anon key. Loss-free: grants only.

grant select on public.profiles_public to anon, authenticated;
