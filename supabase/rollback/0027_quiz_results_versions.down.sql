-- Undoes 0027_quiz_results_versions.sql.
--
-- Refuses while any v2 result exists: `vector` cannot be made not null
-- again over a row that has none, and dropping the point would lose the
-- only record of where that reader landed. Clear v2 rows first, which is
-- an (a) write of its own.
--
-- The view is dropped and made again rather than replaced, because a
-- replaced view cannot lose columns; the grants are then set back to what
-- 0016 and 0022 left (select for the two client roles, all for the server
-- role), which a fresh view would not otherwise have.
--
-- It contains DROP statements: run by hand in the SQL Editor, never by the
-- agent (docs/decisions.md). By hand outside the editor, it is
-- `psql --single-transaction`.

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public.quiz_results where quiz_version <> 1) then
    raise exception '0027 rollback: % v2 result(s) exist; clear them first',
      (select count(*) from public.quiz_results where quiz_version <> 1);
  end if;
end
$$;

drop view public.public_results;
create view public.public_results as
  select id, school, secondary, vector, challenge_from, created_at, is_sample
  from public.quiz_results;
revoke all on public.public_results from public, anon, authenticated;
grant select on public.public_results to anon, authenticated;
grant all on public.public_results to service_role;

alter table public.quiz_results drop constraint quiz_results_shape_by_version;
alter table public.quiz_results drop constraint quiz_results_quiz_version_check;
alter table public.quiz_results alter column vector set not null;
alter table public.quiz_results
  drop column map_y,
  drop column map_x,
  drop column quiz_version;
