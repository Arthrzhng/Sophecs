#!/usr/bin/env bash
# Tests 0030_sample_reply_claims.sql and its rollback on a throwaway
# database on a local Postgres:
# - one claim per reader: a second claim for the same reader, for the same
#   exchange or another, is refused while the first holds; another reader
#   is not held up;
# - two sessions racing for one reader's claim: exactly one holds it;
# - a claim given back only with its own token; one that expires is taken
#   over; p_seconds outside 1 to 600 refused;
# - the claim goes with the reader's account (on delete cascade);
# - client roles refused, the server role allowed, an empty search path,
#   the caller's rights;
# - a second apply stopping with nothing changed; the rollback removing
#   it all; and 0030 again.
#
#   scripts/test-0030-sample-reply-claims.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0030_test_$$"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

FAILED=0
CHECKS=0
say() { printf '\n== %s ==\n' "$1"; }
q() { psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
try_apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" 2>&1 || true; }
expect() {
  CHECKS=$((CHECKS + 1))
  if [ "$2" = "$3" ]; then printf '  ok    %s: %s\n' "$1" "$3"
  else printf '  FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3"; FAILED=1; fi
}
as_role() {
  local out
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else printf '%s' "$out" | { grep -v -E '^(BEGIN|ROLLBACK|SET)?$' || true; } | tail -1; fi
}
claim() { q "select public.claim_sample_reply('$1', '$2', '$3', ${4:-120})"; }
release() { q "select public.release_sample_reply('$1', '$2')" >/dev/null; }
tables_def() {
  echo "$(q "select count(*) from pg_class where relname = 'sample_reply_claims'") $(q "select count(*) from pg_proc where proname in ('claim_sample_reply', 'release_sample_reply')")"
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0030"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on sequences to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 30 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null
BEFORE="$(tables_def)"

A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
for u in $A $B; do q "insert into auth.users (id) values ('$u')" >/dev/null; done

say "0030"
apply "$REPO/supabase/migrations/0030_sample_reply_claims.sql"

say "one claim per reader"
expect "the reader's first claim" t "$(claim $A ex1 tok1)"
expect "the same reader, the same exchange, refused" f "$(claim $A ex1 tok2)"
expect "the same reader, another exchange, refused" f "$(claim $A ex2 tok3)"
expect "the claim still the first's" "ex1 tok1" "$(q "select exchange_id || ' ' || token from sample_reply_claims where reader_id = '$A'")"
expect "another reader not held up" t "$(claim $B ex9 tokB)"

say "given back only with its own token"
release $A tok2
expect "a wrong token gives nothing back" f "$(claim $A ex2 tok4)"
release $A tok1
expect "its own token gives it back" t "$(claim $A ex2 tok5)"
release $A tok5

say "expiry"
expect "a one-second claim" t "$(claim $A ex1 short 1)"
sleep 1.3
expect "taken over once expired" t "$(claim $A ex2 after)"
expect "now the new claim's" "ex2 after" "$(q "select exchange_id || ' ' || token from sample_reply_claims where reader_id = '$A'")"
release $A after

say "two sessions racing for one reader"
# The first holds its claim's row in an open transaction; the second's
# insert waits on it, then finds the row unexpired.
psql -X -At -d "$DB" -c "begin; select public.claim_sample_reply('$A', 'exA', 'racer1', 120); select pg_sleep(2); commit;" > "/tmp/claude-0030-$$-1" 2>&1 &
P1=$!
sleep 0.5
psql -X -At -d "$DB" -c "select public.claim_sample_reply('$A', 'exB', 'racer2', 120);" > "/tmp/claude-0030-$$-2" 2>&1 &
P2=$!
wait $P1; wait $P2
R1=$(grep -E '^(t|f)$' "/tmp/claude-0030-$$-1" | head -1); R2=$(grep -E '^(t|f)$' "/tmp/claude-0030-$$-2" | head -1)
rm -f "/tmp/claude-0030-$$-1" "/tmp/claude-0030-$$-2"
expect "the first holds it" t "$R1"
expect "the second, which waited, is refused" f "$R2"
expect "one row for the reader" 1 "$(q "select count(*) from sample_reply_claims where reader_id = '$A'")"
release $A racer1

say "bounds"
bound() { # Output captured first: under pipefail a failing psql hides grep's match.
  local out; out=$(q "select public.claim_sample_reply('$A', 'x', 'y', $1)" 2>&1 || true)
  if printf '%s' "$out" | grep -q 'between 1 and 600'; then echo refused; else echo "accepted: $out"; fi
}
expect "p_seconds 0 refused" refused "$(bound 0)"
expect "p_seconds 601 refused" refused "$(bound 601)"
expect "nothing claimed by either" 0 "$(q "select count(*) from sample_reply_claims where token = 'y'")"

say "the claim goes with the account"
claim $B ex9 tokB2 >/dev/null || true
q "delete from auth.users where id = '$B'" >/dev/null
expect "no claim left for a deleted reader" 0 "$(q "select count(*) from sample_reply_claims where reader_id = '$B'")"

say "who may call it"
expect "anon refused the claim" denied "$(as_role anon "select public.claim_sample_reply('$A', 'x', 'y', 60)")"
expect "authenticated refused the claim" denied "$(as_role authenticated "select public.claim_sample_reply('$A', 'x', 'y', 60)")"
expect "anon refused the release" denied "$(as_role anon "select public.release_sample_reply('$A', 'y')")"
expect "authenticated refused the table" denied "$(as_role authenticated "select count(*) from public.sample_reply_claims")"
expect "the server role may claim" t "$(as_role service_role "select public.claim_sample_reply('$A', 'x', 'svc', 60)")"
expect "its own search_path is empty" 'search_path=""' "$(q "select string_agg(distinct array_to_string(proconfig, ','), ';') from pg_proc where proname in ('claim_sample_reply', 'release_sample_reply')")"
expect "both run with the caller's rights" 'f' "$(q "select bool_or(prosecdef) from pg_proc where proname in ('claim_sample_reply', 'release_sample_reply')")"
expect "row level security on" t "$(q "select relrowsecurity from pg_class where relname = 'sample_reply_claims'")"

say "0030 a second time"
SECOND="$(try_apply "$REPO/supabase/migrations/0030_sample_reply_claims.sql")"
expect "stops" stopped "$(printf '%s' "$SECOND" | grep -q 'already exists' && echo stopped || echo "went through: $SECOND")"

say "rollback, and 0030 again"
apply "$REPO/supabase/rollback/0030_sample_reply_claims.down.sql"
expect "everything as before 0030" "$BEFORE" "$(tables_def)"
apply "$REPO/supabase/migrations/0030_sample_reply_claims.sql"
expect "back" t "$(claim $A again tokZ)"

echo
if [ "$FAILED" = 0 ]; then echo "all $CHECKS checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
