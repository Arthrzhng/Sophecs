-- No client may update a challenge.
--
-- 0001 gave anon and authenticated an update policy on challenges,
-- "accept sets challengee", with using (true) and with check (true). An
-- update policy decides which rows an update may reach (using) and what
-- they may become (with check), and a select policy narrows an update
-- only when the statement reads a column, so anyone holding the site's
-- public key could rewrite any column of every challenge: its status, its
-- results, and the debate ids that recordChallengeDebate trusts when it
-- moves two readers' ratings.
--
-- The site never used it. Accepting a challenge (submitQuizResult),
-- assigning its topic (assignChallengeTopic), recording a debate on it
-- and completing it (recordChallengeDebate) all write with the server
-- role, which row level security does not apply to. Arthur's ruling of
-- 2026-11-04: drop it.
--
-- With no update policy left, row level security refuses every update by
-- anon and authenticated. The table's grants are unchanged; the wider
-- review of client grants is a separate decision. No row changes.
--
-- Locks: DROP POLICY takes ACCESS EXCLUSIVE on challenges for the
-- catalogue change, milliseconds. No transaction of its own: the Supabase
-- runner wraps the file, and by hand it is `psql --single-transaction`.
-- The rollback, supabase/rollback/0021_challenges_no_client_update.down.sql,
-- recreates the policy exactly, and scripts/test-0021-challenges-update.sh
-- runs both on a throwaway local database.

-- Waits at most five seconds for the lock rather than queueing behind a
-- long reader and holding up every challenges write behind it.
set local lock_timeout = '5s';

drop policy "accept sets challengee" on public.challenges;
