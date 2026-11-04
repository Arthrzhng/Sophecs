#!/usr/bin/env bash
# Proves migration 0021 on a throwaway local database, under the grants
# production has (every table in public granted to anon, authenticated and
# service_role):
#
# - before it, anon reaches and rewrites every challenge with an update
#   that has no filter, and a party rewrites its own;
# - after it, neither reaches any row, the server role still updates,
#   and reading and creating a challenge work as before;
# - the rollback restores the policy exactly, and 0021 applies again.
#
# Usage: scripts/test-0021-challenges-update.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0021c_test_$$"
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
# Runs one statement as a role, as a signed-in user and with the x-anon-id
# header the site sends, inside a transaction that is rolled back. Prints
# how many rows it reached: the command tag's count for an update or an
# insert, or a count(*)'s value. An error prints as such. No RETURNING:
# it makes the select policy apply to the rows an update reaches, so it
# would measure a narrower reach than a statement without it has.
R=88888888-8888-8888-8888-888888888888
ANON=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
reach() {
  local out
  out=$(psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "begin; set local role $1; select set_config('request.jwt.claim.sub', '${3:-}', true); select set_config('request.headers', '{\"x-anon-id\": \"$ANON\"}', true); $2; rollback;" 2>&1) || { echo "error: $(printf '%s' "$out" | grep ERROR)"; return; }
  printf '%s\n' "$out" | grep -v '^ROLLBACK$' | tail -1 | awk '{print $NF}'
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, every migration before 0021, production's grants"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 21 ] || continue
  apply "$f"
done
for t in challenges quiz_results; do
  q "grant all on public.$t to anon, authenticated, service_role" >/dev/null
done

psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<ROWS
insert into auth.users (id) values ('$R');
insert into quiz_results (id, school, vector, answers, anon_id, user_id) values
  ('rmine', 'stoicism', '{}', '[]', '$ANON', '$R'),
  ('rother', 'stoicism', '{}', '[]', gen_random_uuid(), null);
insert into challenges (id, challenger_result_id) values ('c1', 'rmine'), ('c2', 'rother'), ('c3', 'rother');
ROWS

say "before 0021: the hole"
# In SQL as the anon role. The Data API refuses an update with no filter
# (Supabase runs it with safeupdate), and a filter reads a column, which
# makes the select policy apply: through the API the reach is the rows the
# caller can read, so the live hole is a party rewriting its own.
expect "anon, no filter, reaches every challenge" 3 "$(reach anon "update challenges set status = 'complete'")"
expect "anon with a filter (the Data API's only form) reaches none it cannot read" 0 "$(reach anon "update challenges set status = 'complete' where id = 'c2'")"
expect "a party, with a filter, reaches its own" 1 "$(reach authenticated "update challenges set status = 'complete' where id = 'c1'" $R)"
expect "and can rewrite any column of it" 1 "$(reach authenticated "update challenges set challengee_result_id = 'rother', status = 'complete' where id = 'c1'" $R)"

say "apply 0021"
apply "$REPO/supabase/migrations/0021_challenges_no_client_update.sql"
expect "policies left on challenges" "anon insert own|challenges read party" "$(q "select string_agg(policyname, '|' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'challenges'")"
expect "no update policy" 0 "$(q "select count(*) from pg_policies where schemaname = 'public' and tablename = 'challenges' and cmd in ('UPDATE', 'ALL')")"
expect "row level security still on" t "$(q "select relrowsecurity from pg_class where oid = 'public.challenges'::regclass")"

say "after 0021"
expect "anon, no filter, reaches nothing" 0 "$(reach anon "update challenges set status = 'complete'")"
expect "a party reaches nothing" 0 "$(reach authenticated "update challenges set status = 'complete' where id = 'c1'" $R)"
expect "a party still reads its own" 1 "$(reach authenticated "select count(*) from challenges" $R)"
expect "anyone can still create one (unchanged; the grants review is separate)" 1 "$(reach anon "insert into challenges (id, challenger_result_id) values ('c9', 'rother')")"
expect "the server role still updates (the site's own writes)" 3 "$(reach service_role "update challenges set status = 'accepted'")"
expect "no row changed" "open|open|open" "$(q "select string_agg(status, '|' order by id) from challenges")"

say "rollback, then 0021 again"
apply "$REPO/supabase/rollback/0021_challenges_no_client_update.down.sql"
expect "the policy is back as 0001 made it" "UPDATE|{anon,authenticated}|true|true" "$(q "select cmd || '|' || roles::text || '|' || qual || '|' || with_check from pg_policies where schemaname = 'public' and tablename = 'challenges' and policyname = 'accept sets challengee'")"
expect "anon reaches every challenge again" 3 "$(reach anon "update challenges set status = 'complete'")"
apply "$REPO/supabase/migrations/0021_challenges_no_client_update.sql"
expect "re-applied: anon reaches nothing" 0 "$(reach anon "update challenges set status = 'complete'")"

if [ "$FAILED" -ne 0 ]; then echo; echo "== FAILED =="; exit 1; fi
echo; echo "== all checks passed =="
