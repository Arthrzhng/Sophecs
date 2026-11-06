-- Undoes 0028_judge_reservations.sql. Loses only reservations in flight,
-- which expire within a few minutes anyway.
--
-- Deploy the route without the reservation first: a route that calls
-- these functions after they are gone refuses every submission (it fails
-- closed, as for a count it cannot read).
--
-- It contains DROP statements: run by hand in the SQL Editor, never by the
-- agent (docs/decisions.md). By hand outside the editor, it is
-- `psql --single-transaction`.
--
-- Dropping the table drops its foreign key, which takes SHARE ROW
-- EXCLUSIVE on auth.users as creating it did; hence the lock timeout.

set local lock_timeout = '5s';

drop function public.release_judge_reservation(bigint);
drop function public.reserve_judge_submission(uuid, integer, integer, integer, integer);
drop table public.judge_reservations;
