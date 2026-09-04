-- Phase 2a: identity and claiming.
--
-- profiles already exists from Phase 1 (id, handle, display_name,
-- created_at) with auth scaffolding pulled forward — see docs/decisions.md.
-- This migration adds every column Phase 2 needs on profiles in one pass:
-- the brief names exactly three new Phase 2 migration files (this one,
-- 0003_debates, 0004_ai_calls) and doesn't provide a second profiles
-- migration, so elo/streak/streak_updated_on — not used until 2c — land
-- here alongside school, which 2a's claim flow needs immediately.
alter table profiles
  add column school text check (school in ('stoicism', 'utilitarianism', 'virtue-ethics')),
  add column elo numeric not null default 1200,
  add column streak int not null default 0,
  add column streak_updated_on date,
  add column argument_default_public boolean not null default false,
  add column school_history jsonb not null default '[]',
  add column tz text;

-- Phase 1's "public read" policy exposed every column via `using (true)`,
-- including everything this migration just added. The brief's own design
-- is a curated profiles_public view instead ("the table policy exists so
-- /me can read own full row"), so the base table narrows to owner-only and
-- public consumers read the view through the admin client — the same
-- pattern Phase 1 established for quiz_results/public_results.
drop policy "public read" on profiles;
create policy "profiles read own" on profiles for select using (auth.uid () = id);

create view profiles_public as
  select id, handle, display_name, school, elo, streak, created_at from profiles;
