#!/usr/bin/env bash
# Applies every migration to a throwaway local database, rolls the last two
# back, applies them again, and times each statement while holding its
# lock.
#
# There is no Docker and no Supabase CLI in this environment, so this drives
# the PostgreSQL 16 server binaries directly. docs/phase2-recon.md section 5
# has the detail; the short version is that a bare Postgres needs a shim for
# the `auth` schema, `auth.users`, the three Supabase roles and `auth.uid()`
# before the migrations will apply, and nothing else.
#
# Usage: scripts/test-migrations.sh [port] [datadir]
set -euo pipefail

PORT="${1:-55432}"
PGDATA_DIR="${2:-/var/lib/postgresql/sophecs-test/data}"
DB="sophecs_migration_test_$$"
BIN=/usr/lib/postgresql/16/bin
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

say() { printf '\n== %s ==\n' "$1"; }
# --single-transaction, because the files no longer open their own: a
# failure part way through has to roll back everything before it, which is
# what the runner does in production.
psql_q() { psql --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" "$@"; }

"$BIN/pg_isready" -h 127.0.0.1 -p "$PORT" >/dev/null || {
  echo "No server on port $PORT. Start one from $PGDATA_DIR first." >&2
  exit 1
}

cleanup() { psql -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
say "database $DB created on port $PORT"

say "supabase shim"
psql_q -f "$REPO/scripts/local-auth-shim.sql"

say "forward: every migration in order"
for f in "$REPO"/supabase/migrations/*.sql; do
  start=$(date +%s%N)
  psql_q -f "$f"
  printf '  %-40s %6.1f ms\n' "$(basename "$f")" "$(( $(date +%s%N) - start ))e-6"
done

say "state after the forward migrations"
psql -At -d "$DB" -c "
  select c.relname || '.' || con.conname || ' = ' || pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and pg_get_constraintdef(con.oid) ilike '%confucian%'
  order by 1"
psql -At -d "$DB" -c "
  select 'debates.motion_text is ' || data_type || ', nullable=' || is_nullable
  from information_schema.columns
  where table_schema='public' and table_name='debates' and column_name='motion_text'"

say "rollback: 0015 then 0014"
for f in "$REPO/supabase/rollback/0015_debates_motion_text.down.sql" \
         "$REPO/supabase/rollback/0014_more_schools.down.sql"; do
  start=$(date +%s%N)
  psql_q -f "$f"
  printf '  %-40s %6.1f ms\n' "$(basename "$f")" "$(( $(date +%s%N) - start ))e-6"
done

say "state after the rollbacks"
psql -At -d "$DB" -c "
  select count(*) || ' constraint(s) still mention a new school (expected 0)'
  from pg_constraint con where pg_get_constraintdef(con.oid) ilike '%confucian%'"
psql -At -d "$DB" -c "
  select count(*) || ' motion_text column(s) (expected 0)'
  from information_schema.columns
  where table_schema='public' and table_name='debates' and column_name='motion_text'"
psql -At -d "$DB" -c "
  select count(*) || ' school constraint(s) back to the original three (expected 4)'
  from pg_constraint con
  where pg_get_constraintdef(con.oid) ilike '%stoicism%'
    and pg_get_constraintdef(con.oid) not ilike '%confucian%'"

say "forward again, to prove the rollback left a re-appliable database"
for f in "$REPO/supabase/migrations/0014_more_schools.sql" \
         "$REPO/supabase/migrations/0015_debates_motion_text.sql"; do
  start=$(date +%s%N)
  psql_q -f "$f"
  printf '  %-40s %6.1f ms\n' "$(basename "$f")" "$(( $(date +%s%N) - start ))e-6"
done

say "a new school is accepted, and a made-up one still is not"
psql -At -d "$DB" -c "
  insert into quiz_results (id, school, secondary, vector, answers, anon_id)
  values ('probe-conf','confucian','ubuntu','{}'::jsonb,'[]'::jsonb, gen_random_uuid())
  returning 'accepted ' || school || '/' || secondary"
# This insert is meant to fail, so its exit status is captured rather than
# piped: under `set -e` with `pipefail` a failing psql in a pipeline killed
# the script here, and every step after it silently never ran.
rejected=$(psql -d "$DB" -c "
  insert into quiz_results (id, school, secondary, vector, answers, anon_id)
  values ('probe-moh','mohism',null,'{}'::jsonb,'[]'::jsonb, gen_random_uuid())" 2>&1 || true)
printf '%s\n' "$rejected" | grep -o 'violates check constraint "[^"]*"' | sed 's/^/  rejected, /'

say "debates_public still hides an unpublished argument"
psql -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'PRIV'
insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222');
insert into debate_topics (slug,title,motion,stances,micro_before,micro_after,sort,active)
  values ('priv','Priv','A motion.','{}'::jsonb,'a','b',99,true);
insert into debates (id,user_id,topic_slug,school,argument,argument_public,motion_text)
  values ('privNo','22222222-2222-2222-2222-222222222222','priv','stoicism','secret words',false,'stored wording'),
         ('privYes','22222222-2222-2222-2222-222222222222','priv','stoicism','open words',true,'stored wording');
PRIV
# The privacy rule the verdict page depends on, at the boundary that
# decides it. 2D added a second read to that page for motion_text, and
# this is the thing that must not have moved: the view nulls `argument`
# unless argument_public, whatever else the page reads.
psql -At -d "$DB" -c "
  select '  ' || id || ': argument ' || coalesce('= ' || quote_literal(argument), 'hidden')
  from debates_public where topic_slug = 'priv' order by id"
psql -At -d "$DB" -c "
  select '  motion_text is readable for both: ' ||
         (count(*) filter (where motion_text = 'stored wording'))::text || ' of 2'
  from debates where topic_slug = 'priv'"

say "done"
