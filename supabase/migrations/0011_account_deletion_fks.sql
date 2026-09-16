-- Account deletion was broken for anyone who had ever debated.
--
-- `debates.user_id` and `ai_calls.user_id` both referenced auth.users with
-- no ON DELETE clause, and `debates.user_id` was NOT NULL, so
-- `auth.admin.deleteUser` hit a foreign-key violation and /me/settings
-- returned an error instead of deleting the account. Found while verifying
-- Task 5's reading_responses cascade; see docs/decisions.md.
--
-- Both become ON DELETE SET NULL rather than CASCADE, for the reason
-- already recorded for quiz_results: a verdict page is a public link, and
-- deleting the row would 404 something a stranger may have bookmarked. The
-- argument text is a separate question, handled in deleteAccount().

alter table debates alter column user_id drop not null;

alter table debates drop constraint if exists debates_user_id_fkey;
alter table debates add constraint debates_user_id_fkey
  foreign key (user_id) references auth.users on delete set null;

alter table ai_calls drop constraint if exists ai_calls_user_id_fkey;
alter table ai_calls add constraint ai_calls_user_id_fkey
  foreign key (user_id) references auth.users on delete set null;
