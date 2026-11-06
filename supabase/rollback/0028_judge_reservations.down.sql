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
-- Dropping the table drops its foreign key's triggers on auth.users, which
-- takes ACCESS EXCLUSIVE on auth.users until it commits: it holds up reads
-- there too (every sign-in, and `getUser` on every signed-in request) for
-- the milliseconds of the drop, or for up to the five-second
-- `lock_timeout` if a transaction is already reading auth.users, after
-- which it gives up with nothing dropped. Run it at a quiet moment.

set local lock_timeout = '5s';

drop function public.release_judge_reservation(bigint);
drop function public.reserve_judge_submission(uuid, integer, integer, integer, integer);
drop table public.judge_reservations;
