-- Rolls back 0016 by restoring the grants it removed, exactly as they
-- stood in production on 2026-11-03 before it was applied (snapshot in
-- docs/seed-snapshots/2026-11-03-public-view-grants.json).
--
-- THIS REOPENS THE HOLE 0016 CLOSED: anyone with the anon key can again
-- write through the four views past row level security. Run it only if
-- 0016 broke something that cannot be fixed forward, and fix forward as
-- soon as possible after.
--
-- Loss-free: it changes grants only, and no row.

grant insert, update, delete, truncate, references, trigger
  on public.debates_public,
     public.exchanges_public,
     public.profiles_public,
     public.public_results
  to anon, authenticated;

grant execute
  on function public.is_class_member(text, uuid),
              public.is_class_owner(text, uuid)
  to public, anon;
