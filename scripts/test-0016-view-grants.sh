#!/usr/bin/env bash
# Proves migration 0016 on a throwaway local database: that the hole it
# closes is real under production's grants, that it closes it for every
# write on all four views and leaves SELECT working, that signed-out
# callers lose the class helpers and signed-in ones keep them, and that its
# rollback restores production's grants exactly and the migration then
# re-applies.
#
# A bare Postgres does not have Supabase's default privileges, under which
# anon and authenticated get everything on anything made in `public`, so
# without them 0016 would revoke nothing and pass trivially. The grants are
# therefore recreated first, from docs/seed-snapshots/
# 2026-11-03-public-view-grants.json, before anything is checked.
#
# Usage: scripts/test-0016-view-grants.sh [port]
# Needs a local PostgreSQL 16 server on that port; see
# scripts/test-migrations.sh for how one is started here.
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0016_test_$$"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

VIEWS="debates_public exchanges_public profiles_public public_results"
FAILED=0
say() { printf '\n== %s ==\n' "$1"; }
q() { psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
expect() { # expect <what> <expected> <actual>
  if [ "$2" = "$3" ]; then printf '  ok    %s: %s\n' "$1" "$3"
  else printf '  FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3"; FAILED=1; fi
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim and migrations 0001 to 0015"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  # 0001 to 0015 only: 0016 is under test, and anything after it assumes it.
  [ "$((10#$(basename "$f" | cut -c1-4)))" -le 15 ] || continue
  apply "$f"
done

say "production's grants, recreated"
for v in $VIEWS; do
  q "grant all on public.$v to anon, authenticated, service_role" >/dev/null
done
q "grant execute on function public.is_class_member(text, uuid), public.is_class_owner(text, uuid) to public, anon, authenticated, service_role" >/dev/null
# The class tables too, as Supabase grants them, so the class policies are
# what decides a read and not a missing table grant.
q "grant all on public.classes, public.class_members to anon, authenticated, service_role" >/dev/null

say "one row behind each view"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'ROWS'
insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333');
insert into profiles (id, handle, display_name, school, elo, streak)
  values ('33333333-3333-3333-3333-333333333333', 'probe', 'Probe', 'stoicism', 1000, 0);
insert into debate_topics (slug,title,motion,stances,micro_before,micro_after,sort,active)
  values ('grants','Grants','A motion.','{}'::jsonb,'a','b',99,true);
insert into debates (id,user_id,topic_slug,school,argument,argument_public,score)
  values ('grantsD','33333333-3333-3333-3333-333333333333','grants','stoicism','words',false,50);
insert into quiz_results (id, school, secondary, vector, answers, anon_id)
  values ('grantsQ','stoicism','utilitarianism','{}'::jsonb,'[]'::jsonb, gen_random_uuid());
ROWS

# Runs one statement as a role, inside a transaction that is always rolled
# back, and prints "allowed" or "denied".
as_role() { # as_role <role> <sql>
  local out
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else echo allowed; fi
}

say "before 0016: the hole is real"
expect "anon UPDATE debates_public.score" allowed "$(as_role anon "update public.debates_public set score = 99 where id = 'grantsD'")"
expect "anon DELETE public_results" allowed "$(as_role anon "delete from public.public_results where id = 'grantsQ'")"
expect "anon UPDATE profiles_public.elo" allowed "$(as_role anon "update public.profiles_public set elo = 9999")"
expect "anon reads classes (policy calls the helper)" allowed "$(as_role anon "select count(*) from public.classes")"
expect "row untouched after the rolled-back probes" 50 "$(q "select score from debates where id = 'grantsD'")"

say "apply 0016"
apply "$REPO/supabase/migrations/0016_public_views_read_only.sql"

check_after() {
  for role in anon authenticated; do
    for v in $VIEWS; do
      expect "$role SELECT on $v" t "$(q "select has_table_privilege('$role', 'public.$v', 'SELECT')")"
      for p in INSERT UPDATE DELETE TRUNCATE REFERENCES TRIGGER; do
        expect "$role $p on $v" f "$(q "select has_table_privilege('$role', 'public.$v', '$p')")"
      done
    done
  done
  expect "anon selects debates_public" allowed "$(as_role anon "select count(*) from public.debates_public")"
  expect "anon selects profiles_public" allowed "$(as_role anon "select count(*) from public.profiles_public")"
  expect "anon UPDATE debates_public" denied "$(as_role anon "update public.debates_public set score = 99 where id = 'grantsD'")"
  expect "anon INSERT public_results" denied "$(as_role anon "insert into public.public_results (id, school) values ('x', 'stoicism')")"
  expect "anon DELETE exchanges_public" denied "$(as_role anon "delete from public.exchanges_public")"
  expect "authenticated UPDATE profiles_public" denied "$(as_role authenticated "update public.profiles_public set elo = 9999")"
  expect "authenticated DELETE public_results" denied "$(as_role authenticated "delete from public.public_results where id = 'grantsQ'")"
  for fn in is_class_member is_class_owner; do
    expect "anon EXECUTE $fn" f "$(q "select has_function_privilege('anon', 'public.$fn(text, uuid)', 'EXECUTE')")"
    expect "authenticated EXECUTE $fn" t "$(q "select has_function_privilege('authenticated', 'public.$fn(text, uuid)', 'EXECUTE')")"
    expect "service_role EXECUTE $fn" t "$(q "select has_function_privilege('service_role', 'public.$fn(text, uuid)', 'EXECUTE')")"
  done
  expect "authenticated reads classes (policy calls the helper)" allowed "$(as_role authenticated "select count(*) from public.classes")"
  expect "authenticated reads class_members (policy calls the helper)" allowed "$(as_role authenticated "select count(*) from public.class_members")"
  # What anon loses: its query on the class tables now fails rather than
  # returning nothing. No signed-out page makes it; see the migration.
  expect "anon reads classes" denied "$(as_role anon "select count(*) from public.classes")"
  expect "rows unchanged" "50 1 1" "$(q "select (select score from debates where id='grantsD')::int || ' ' || (select count(*) from quiz_results where id='grantsQ') || ' ' || (select count(*) from profiles where elo = 1000)")"
}

say "after 0016"
check_after

say "rollback restores production's grants"
apply "$REPO/supabase/rollback/0016_public_views_read_only.down.sql"
for v in $VIEWS; do
  expect "anon privileges on $v" "DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE" \
    "$(q "select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = '$v' and grantee = 'anon'")"
done
expect "anon EXECUTE is_class_member" t "$(q "select has_function_privilege('anon', 'public.is_class_member(text, uuid)', 'EXECUTE')")"

say "0016 re-applies after its rollback"
apply "$REPO/supabase/migrations/0016_public_views_read_only.sql"
check_after

if [ "$FAILED" -ne 0 ]; then say "FAILED"; exit 1; fi
say "all checks passed"
