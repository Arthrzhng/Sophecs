-- Drops the five policies 0022 made unreachable. Arthur's ruling of
-- 2026-11-05 on Checkpoint A, item 5: "drop the five unused policies, NOT
-- 'own update'. Usual process." (docs/decisions.md, "Arthur's rulings of
-- 2026-11-05 on Checkpoint A").
--
-- Run by Arthur in the SQL Editor, as his instruction of the same day
-- asks for statements with DROP, so like 0021 it will not appear in
-- Supabase's migration list.
--
-- Each is an INSERT policy on a table where 0022 took INSERT from anon and
-- authenticated, so none can be reached; the site makes all five writes
-- with the server role, which row level security does not apply to:
-- - debates, "debates insert own" (src/app/api/judge/route.ts);
-- - profiles, "own insert" (src/lib/claim.ts, the server's first-sign-in
--   insert);
-- - challenges, "anon insert own" (createChallenge, src/app/actions.ts);
-- - quiz_results, "anon insert own" (submitQuizResult, src/app/actions.ts);
-- - class_members, "member join self" (joinClass, src/app/me/actions.ts).
--
-- Not "own update" on profiles: 0022 gave signed-in readers back UPDATE of
-- display_name and argument_default_public, and setDisplayName and
-- setArgumentDefaultPublic write through it with the signed-in client.
-- Without it both would change nothing and still report success.
--
-- Locks: DROP POLICY takes ACCESS EXCLUSIVE on each table for the
-- catalogue change, milliseconds. lock_timeout keeps it from queueing
-- behind a long reader. Run the whole file at once. The rollback,
-- supabase/rollback/0025_drop_unreachable_policies.down.sql, recreates
-- the five exactly, and scripts/test-0024-checkpoint-a-database.sh runs
-- both on a throwaway local database.

set local lock_timeout = '5s';

drop policy "debates insert own" on public.debates;
drop policy "own insert" on public.profiles;
drop policy "anon insert own" on public.challenges;
drop policy "anon insert own" on public.quiz_results;
drop policy "member join self" on public.class_members;
