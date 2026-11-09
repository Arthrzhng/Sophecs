-- Undoes 0030_sample_reply_claims.sql. Loses only claims in flight, which
-- expire within two minutes anyway.
--
-- Turn SAMPLE_REPLIES off and redeploy first, or deploy code without the
-- claim: code that calls these functions after they are gone refuses
-- every sample reply (it fails closed, as for a ceiling it cannot read).
--
-- It contains DROP statements: run by hand in the SQL Editor, never by the
-- agent (docs/decisions.md). By hand outside the editor, it is
-- `psql --single-transaction`.
--
-- Dropping the table drops its foreign key's triggers on auth.users, which
-- takes ACCESS EXCLUSIVE on auth.users until it commits, for the
-- milliseconds of the drop, or up to the five-second `lock_timeout`, after
-- which it gives up with nothing dropped. Run it at a quiet moment.

set local lock_timeout = '5s';

drop function public.release_sample_reply(uuid, text);
drop function public.claim_sample_reply(uuid, text, text, integer);
drop table public.sample_reply_claims;
