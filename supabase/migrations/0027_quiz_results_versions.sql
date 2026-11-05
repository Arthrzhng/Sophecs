-- Quiz v2's results beside v1's: Stage 5, Gate 1 (docs/stage5-plan.md).
--
-- Arthur's ruling of 2026-11-05 on Checkpoint B, (a) 3: "Gate 1: yes to the
-- quiz_results migration and the frozen actions.ts edit."
--
-- v1 stores three school weights in `vector`. v2 places a reader at a
-- point on a map (docs/quiz-v2.md, sections 4 and 6) and has no
-- three-school vector to give; a made-up one would be read as real by
-- code written for v1. So a result now says which quiz it came from:
--
-- - `quiz_version`, 1 or 2, default 1. Every existing row is v1 and is not
--   rewritten: a constant default is stored once in the catalogue.
-- - `map_x`, `map_y`, the v2 point, each between -1 and 1 (a mean of
--   option vectors that lie inside the unit circle). Null on a v1 row.
-- - `vector` is nullable, and a check holds each version to its shape: a
--   v1 row has a vector and no point, a v2 row a point and no vector.
-- - `public_results` carries the three new columns, appended (a replaced
--   view may only add columns at the end), so the result pages can tell
--   the versions apart. They become readable with the anon key, as every
--   other column of the view is: which quiz, and where on the map, which
--   is what the result page itself shows. Grants on the view are
--   unchanged; `create or replace` keeps them.
--
-- Code that inserts without naming a version, which is all of it today,
-- writes v1 rows exactly as before. Nothing writes a v2 row until Stage 5
-- step 4, under Gate 2.
--
-- Locks, until commit: ACCESS EXCLUSIVE on quiz_results for the column
-- adds, the nullability change and the two checks, the checks scanning
-- every row once (8,528 on 2026-11-05) to validate them; and on
-- public_results. No row is rewritten. No transaction of its own: the
-- Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`.
--
-- Rollback: supabase/rollback/0027_quiz_results_versions.down.sql, which
-- refuses while any v2 row exists, because `vector` cannot be made
-- not null again over one. scripts/test-0027-quiz-results-versions.sh runs
-- both on a throwaway database.

set local lock_timeout = '5s';

alter table public.quiz_results
  add column quiz_version smallint not null default 1,
  add column map_x double precision,
  add column map_y double precision;

alter table public.quiz_results
  add constraint quiz_results_quiz_version_check check (quiz_version in (1, 2));

alter table public.quiz_results alter column vector drop not null;

alter table public.quiz_results
  add constraint quiz_results_shape_by_version check (
    (quiz_version = 1 and vector is not null and map_x is null and map_y is null)
    or (
      quiz_version = 2
      and vector is null
      and map_x is not null and map_x between -1 and 1
      and map_y is not null and map_y between -1 and 1
    )
  );

create or replace view public.public_results as
  select id, school, secondary, vector, challenge_from, created_at, is_sample,
         quiz_version, map_x, map_y
  from public.quiz_results;
