#!/usr/bin/env bash
# Tests 0027_quiz_results_versions.sql and its rollback on a throwaway
# database on a local Postgres: existing rows stay v1 unrewritten, an
# insert that names no version is v1 as before, each version is held to
# its own shape, the view carries the new columns with its grants
# unchanged, the rollback refuses over a v2 row and otherwise restores the
# grants and the not-null, and a second apply.
#
#   scripts/test-0027-quiz-results-versions.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0027_test_$$"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

FAILED=0
say() { printf '\n== %s ==\n' "$1"; }
q() { psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
expect() {
  if [ "$2" = "$3" ]; then printf '  ok    %s: %s\n' "$1" "$3"
  else printf '  FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3"; FAILED=1; fi
}
# "refused" when the statement fails with a check violation, "accepted"
# when it runs; the row is never kept.
try() {
  local out
  out=$(psql -X -At -d "$DB" -c "begin; $1; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "violates check constraint"; then echo refused
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else echo accepted; fi
}
as_role() {
  local out
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else printf '%s' "$out" | grep -v -E '^(BEGIN|ROLLBACK|SET)?$' | tail -1; fi
}
grants() {
  q "select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type)
     from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'public_results'"
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0027"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 27 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null

V='{"stoicism": 0.5, "utilitarianism": 0.3, "virtue-ethics": 0.2}'
say "three v1 results, as production holds them"
q "insert into quiz_results (id, anon_id, school, secondary, vector, answers)
   select 'old' || g, gen_random_uuid(), 'stoicism', 'utilitarianism', '$V', '[]'
   from generate_series(1, 3) g" >/dev/null
BEFORE_GRANTS="$(grants)"
BEFORE_ROWS="$(q "select string_agg(id || ':' || vector::text, ';' order by id) from quiz_results")"

say "0027"
apply "$REPO/supabase/migrations/0027_quiz_results_versions.sql"
expect "existing rows are v1" "3" "$(q "select count(*) from quiz_results where quiz_version = 1")"
expect "existing rows keep their vector, with no point" "$BEFORE_ROWS" "$(q "select string_agg(id || ':' || vector::text, ';' order by id) from quiz_results where map_x is null and map_y is null")"
expect "an insert naming no version is v1, as today's code writes" accepted "$(try "insert into quiz_results (id, anon_id, school, vector, answers) values ('new1', gen_random_uuid(), 'stoicism', '$V', '[]')")"
expect "a v2 row with a point and no vector" accepted "$(try "insert into quiz_results (id, anon_id, school, quiz_version, map_x, map_y, answers) values ('v2', gen_random_uuid(), 'ubuntu', 2, -0.4, 0.31, '[]')")"
expect "a v2 row on the edge of the map" accepted "$(try "insert into quiz_results (id, anon_id, school, quiz_version, map_x, map_y, answers) values ('v2e', gen_random_uuid(), 'ubuntu', 2, -1, 1, '[]')")"
expect "a v1 row with no vector" refused "$(try "insert into quiz_results (id, anon_id, school, answers) values ('x1', gen_random_uuid(), 'stoicism', '[]')")"
expect "a v1 row with a point" refused "$(try "insert into quiz_results (id, anon_id, school, vector, map_x, map_y, answers) values ('x2', gen_random_uuid(), 'stoicism', '$V', 0, 0, '[]')")"
expect "a v2 row with a vector" refused "$(try "insert into quiz_results (id, anon_id, school, quiz_version, vector, map_x, map_y, answers) values ('x3', gen_random_uuid(), 'ubuntu', 2, '$V', 0, 0, '[]')")"
expect "a v2 row with no point" refused "$(try "insert into quiz_results (id, anon_id, school, quiz_version, answers) values ('x4', gen_random_uuid(), 'ubuntu', 2, '[]')")"
expect "a v2 row with half a point" refused "$(try "insert into quiz_results (id, anon_id, school, quiz_version, map_x, answers) values ('x5', gen_random_uuid(), 'ubuntu', 2, 0.2, '[]')")"
expect "a v2 row off the map" refused "$(try "insert into quiz_results (id, anon_id, school, quiz_version, map_x, map_y, answers) values ('x6', gen_random_uuid(), 'ubuntu', 2, 1.01, 0, '[]')")"
expect "a version 3" refused "$(try "insert into quiz_results (id, anon_id, school, quiz_version, vector, answers) values ('x7', gen_random_uuid(), 'stoicism', 3, '$V', '[]')")"
expect "a v1 row cannot be turned into a v2 one in place" refused "$(try "update quiz_results set quiz_version = 2 where id = 'old1'")"
expect "the view's columns" "id,school,secondary,vector,challenge_from,created_at,is_sample,quiz_version,map_x,map_y" \
  "$(q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'public_results'")"
expect "the view's grants are unchanged" "$BEFORE_GRANTS" "$(grants)"
expect "anon reads the version and the point" "old1:1::" "$(as_role anon "select id || ':' || quiz_version || ':' || coalesce(map_x::text, '') || ':' || coalesce(map_y::text, '') from public.public_results where id = 'old1'")"
expect "anon still cannot write through the view" denied "$(as_role anon "update public.public_results set quiz_version = 2 where id = 'old1'")"

say "rollback refuses over a v2 row"
q "insert into quiz_results (id, anon_id, school, quiz_version, map_x, map_y, answers) values ('kept', gen_random_uuid(), 'ubuntu', 2, 0.1, 0.2, '[]')" >/dev/null
OUT=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/rollback/0027_quiz_results_versions.down.sql" 2>&1 || true)
expect "refused, naming the count" yes "$(printf '%s' "$OUT" | grep -q '1 v2 result(s) exist' && echo yes || echo no)"
expect "and nothing changed" "quiz_version" "$(q "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'quiz_results' and column_name = 'quiz_version'")"

say "rollback once the v2 row is gone"
q "delete from quiz_results where id = 'kept'" >/dev/null
apply "$REPO/supabase/rollback/0027_quiz_results_versions.down.sql"
expect "the columns are gone" 0 "$(q "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'quiz_results' and column_name in ('quiz_version', 'map_x', 'map_y')")"
expect "vector is not null again" NO "$(q "select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'quiz_results' and column_name = 'vector'")"
expect "the rows are as they were" "$BEFORE_ROWS" "$(q "select string_agg(id || ':' || vector::text, ';' order by id) from quiz_results")"
expect "the view's grants are as before 0027" "$BEFORE_GRANTS" "$(grants)"
expect "the view is 0023's" "id,school,secondary,vector,challenge_from,created_at,is_sample" \
  "$(q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'public_results'")"

say "0027 again"
apply "$REPO/supabase/migrations/0027_quiz_results_versions.sql"
expect "back" "3" "$(q "select count(*) from quiz_results where quiz_version = 1")"
expect "grants still unchanged" "$BEFORE_GRANTS" "$(grants)"

echo
if [ "$FAILED" = 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
