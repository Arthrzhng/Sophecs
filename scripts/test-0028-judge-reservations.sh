#!/usr/bin/env bash
# Tests 0028_judge_reservations.sql and its rollback on a throwaway
# database on a local Postgres: the cap and the ceiling as the route
# counted them, reservations counted on top, two sessions racing for a
# reader's last slot (one wins, one is refused), expiry, release, another
# reader not held up, client roles refused, the rollback, and a second
# apply.
#
#   scripts/test-0028-judge-reservations.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0028_test_$$"
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
as_role() {
  local out
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else printf '%s' "$out" | { grep -v -E '^(BEGIN|ROLLBACK|SET)?$' || true; } | tail -1; fi
}
# The route's numbers: five arguments, twenty calls, three attempts, held
# for ten minutes.
reserve() { q "select public.reserve_judge_submission('$1', 5, 20, 3, ${2:-600})"; }
outcome() { case "$1" in daily_cap|call_ceiling) echo "$1" ;; ''|*[!0-9]*) echo "odd: $1" ;; *) echo reserved ;; esac; }
calls() { # user, how many, counts_toward_cap, hours ago
  q "insert into ai_calls (id, user_id, kind, model, cost_usd, latency_ms, counts_toward_cap, created_at)
     select '$1-' || g || '-' || md5(random()::text), '$1', 'judge', 'm', 0.01, 1, $3, now() - interval '$4 hours'
     from generate_series(1, $2) g" >/dev/null
}

# Waits until a session holds an advisory lock, so the second session
# below is known to ask while the first holds it.
lock_held() {
  for _ in $(seq 1 100); do
    [ "$(q "select count(*) from pg_locks where locktype = 'advisory' and granted")" -gt 0 ] && return 0
    sleep 0.05
  done
  echo "  FAIL  the first session never took its lock"; FAILED=1
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0028"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on sequences to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 28 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null

A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
C=33333333-3333-4333-8333-333333333333
for u in $A $B $C; do q "insert into auth.users (id) values ('$u')" >/dev/null; done

say "0028"
apply "$REPO/supabase/migrations/0028_judge_reservations.sql"

say "the cap and the ceiling, as the route counted them"
expect "a reader with nothing today is reserved" reserved "$(outcome "$(reserve $A)")"
q "delete from judge_reservations" >/dev/null
calls $B 4 true 1
calls $B 3 false 1
calls $B 9 true 30
expect "four arguments today (a fifth fits); yesterday's do not count" reserved "$(outcome "$(reserve $B)")"
expect "the reservation is the fifth" daily_cap "$(outcome "$(reserve $B)")"
q "delete from judge_reservations" >/dev/null
calls $B 1 true 1
expect "five counted arguments: the cap" daily_cap "$(outcome "$(reserve $B)")"
calls $C 2 true 1
calls $C 16 false 1
expect "18 calls and 3 more would pass 20: the ceiling" call_ceiling "$(outcome "$(reserve $C)")"
q "delete from ai_calls where user_id = '$C' and not counts_toward_cap and id in (select id from ai_calls where user_id = '$C' and not counts_toward_cap limit 1)" >/dev/null
expect "17 calls and 3 more is 20: allowed" reserved "$(outcome "$(reserve $C)")"
expect "a reservation counts as three calls" call_ceiling "$(outcome "$(reserve $C)")"
q "delete from ai_calls; delete from judge_reservations" >/dev/null

say "two sessions racing for the last slot"
calls $A 4 true 1
# Session 1 reserves and holds its transaction open for two seconds;
# session 2 asks a moment later and has to wait for it.
( psql -X -At -d "$DB" -c "begin; select public.reserve_judge_submission('$A', 5, 20, 3, 600); select pg_sleep(2); commit;" \
    | grep -v -E '^(BEGIN|COMMIT)?$' | head -1 > "/tmp/0028-race-1-$$" ) &
lock_held
START=$(date +%s%N)
SECOND=$(reserve $A)
WAITED=$(( ($(date +%s%N) - START) / 1000000 ))
wait
FIRST=$(cat "/tmp/0028-race-1-$$"); rm -f "/tmp/0028-race-1-$$"
expect "the first is reserved" reserved "$(outcome "$FIRST")"
expect "the second is refused at the cap" daily_cap "$(outcome "$SECOND")"
expect "the second waited for the first (ms > 1000)" yes "$([ "$WAITED" -gt 1000 ] && echo yes || echo "no, $WAITED")"
expect "one reservation held" 1 "$(q "select count(*) from judge_reservations where user_id = '$A'")"

say "another reader is not held up"
( psql -X -At -d "$DB" -c "begin; select public.reserve_judge_submission('$A', 5, 20, 3, 600); select pg_sleep(2); commit;" >/dev/null ) &
lock_held
START=$(date +%s%N)
reserve $B >/dev/null
WAITED=$(( ($(date +%s%N) - START) / 1000000 ))
wait
expect "a different reader's reservation does not wait (ms < 1000)" yes "$([ "$WAITED" -lt 1000 ] && echo yes || echo "no, $WAITED")"

say "release and expiry"
q "delete from judge_reservations" >/dev/null
ID=$(reserve $A)
expect "held, the cap is reached" daily_cap "$(outcome "$(reserve $A)")"
q "select public.release_judge_reservation($ID)" >/dev/null
expect "released, the slot is free" reserved "$(outcome "$(reserve $A 1)")"
q "update judge_reservations set expires_at = now() - interval '1 second'" >/dev/null
expect "an expired reservation no longer counts, and is cleared" reserved "$(outcome "$(reserve $A)")"
expect "only the live reservation is left" 1 "$(q "select count(*) from judge_reservations where user_id = '$A'")"

say "who may call it"
expect "anon refused the reservation" denied "$(as_role anon "select public.reserve_judge_submission('$A', 5, 20, 3, 600)")"
expect "authenticated refused the reservation" denied "$(as_role authenticated "select public.reserve_judge_submission('$A', 5, 20, 3, 600)")"
expect "authenticated refused the release" denied "$(as_role authenticated "select public.release_judge_reservation(1)")"
expect "authenticated cannot read the table" denied "$(as_role authenticated "select count(*) from public.judge_reservations")"
expect "anon cannot write the table" denied "$(as_role anon "insert into public.judge_reservations (user_id, expires_at) values ('$A', now())")"
expect "authenticated cannot use its sequence" denied "$(as_role authenticated "select nextval('public.judge_reservations_id_seq')")"
expect "anon cannot use its sequence" denied "$(as_role anon "select nextval('public.judge_reservations_id_seq')")"
expect "the server role may reserve" t "$(as_role service_role "select public.reserve_judge_submission('$C', 5, 20, 3, 600) is not null")"
expect "its search_path is empty" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'reserve_judge_submission'")"
expect "it runs with the caller's rights" f "$(q "select prosecdef from pg_proc where proname = 'reserve_judge_submission'")"
q "delete from auth.users where id = '$A'" >/dev/null
expect "a reader's reservations go with the account" 0 "$(q "select count(*) from judge_reservations where user_id = '$A'")"

say "rollback, and 0028 again"
apply "$REPO/supabase/rollback/0028_judge_reservations.down.sql"
expect "gone" 0 "$(q "select count(*) from pg_proc where proname in ('reserve_judge_submission', 'release_judge_reservation')")"
expect "table gone" "" "$(q "select to_regclass('public.judge_reservations')")"
apply "$REPO/supabase/migrations/0028_judge_reservations.sql"
expect "back" reserved "$(outcome "$(reserve $B)")"

echo
if [ "$FAILED" = 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
