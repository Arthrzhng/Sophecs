-- No client may update a challenge.
--
-- 0001 gave anon and authenticated an update policy on challenges,
-- "accept sets challengee", with using (true) and with check (true). An
-- update policy decides which rows an update may reach (using) and what
-- they may become (with check), and a select policy narrows an update
-- only when the statement reads a column. Through the Data API every
-- update carries a filter (Supabase runs it with safeupdate), so the reach
-- there is the rows the caller can read: a signed-in party could rewrite
-- any column of its own challenges, including the other side's result and
-- the debate ids that recordChallengeDebate trusts when it moves both
-- readers' ratings. In SQL as the anon role, an update with no filter
-- reached every row.
--
-- The site never used it. Creating a challenge (createChallenge),
-- accepting one (submitQuizResult), assigning its topic
-- (assignChallengeTopic), recording a debate on it and completing it
-- (recordChallengeDebate) all write with the server role, which row level
-- security does not apply to. Arthur's ruling of 2026-11-04: "drop the
-- 'accept sets challengee' policy and add a caller-is-a-party check to
-- assignChallengeTopic".
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
-- long reader and holding up every read and write of challenges behind it
-- (ACCESS EXCLUSIVE blocks reads too, /r/[id]'s challenge lookup among
-- them).
set local lock_timeout = '5s';

drop policy "accept sets challengee" on public.challenges;
