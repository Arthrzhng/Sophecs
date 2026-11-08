#!/usr/bin/env bash
# Tests 0029_sample_replies.sql and its rollback on a throwaway database on
# a local Postgres: the two new kinds accepted and an unknown one refused,
# the existing rows kept, the per-kind total and its date bound, client
# roles refused and the server role allowed, the rollback refusing while
# rows of the new kinds exist and going through once there are none, and a
# second apply.
#
#   scripts/test-0029-sample-replies.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0029_test_$$"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres

FAILED=0
say() { printf '\n== %s ==\n' "$1"; }
q() { psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
try_apply() { psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" 2>&1 && echo applied || true; }
expect() {
  if [ "$2" = "$3" ]; then printf '  ok    %s: %s\n' "$1" "$3"
  else printf '  FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3"; FAILED=1; fi
}
as_role() {
  local out
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else printf '%s' "$out" | grep -v -E '^(BEGIN|ROLLBACK|SET)?$' | tail -1; fi
}
insert_kind() {
  local out
  out=$(psql -X -At -d "$DB" -c "insert into ai_calls (id, kind, model, cost_usd, latency_ms) values ('$1', '$2', 'm', 0.01, 1)" 2>&1 || true)
  if printf '%s' "$out" | grep -q "violates check constraint"; then echo refused
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else echo accepted; fi
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0029"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 29 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null

say "before 0029"
expect "sample_reply refused" refused "$(insert_kind pre1 sample_reply)"
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'j' || g, 'judge', 'm', 0.02, 1, '2026-11-02T00:00:00Z' from generate_series(1, 30) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 's' || g, 'screen', 'm', 0.001, 1, '2026-11-02T00:00:00Z' from generate_series(1, 40) g" >/dev/null

say "0029"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "existing rows kept" 70 "$(q "select count(*) from ai_calls")"
expect "sample_reply accepted" accepted "$(insert_kind r0 sample_reply)"
expect "sample_screen accepted" accepted "$(insert_kind s0 sample_screen)"
expect "the four old kinds accepted" "accepted accepted accepted accepted" "$(insert_kind k1 judge) $(insert_kind k2 golden) $(insert_kind k3 judge_allowlist) $(insert_kind k4 screen)"
expect "an unknown kind refused" refused "$(insert_kind x1 sample)"
q "delete from ai_calls where id in ('r0', 's0', 'k1', 'k2', 'k3', 'k4')" >/dev/null

q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'r' || g, 'sample_reply', 'm', 0.006, 1, '2026-11-03T00:00:00Z'::timestamptz + (g || ' seconds')::interval
   from generate_series(1, 1500) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'q' || g, 'sample_screen', 'm', 0.0005, 1, '2026-11-03T00:00:00Z' from generate_series(1, 1000) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'o' || g, 'sample_reply', 'm', 1.00, 1, '2026-10-20T00:00:00Z' from generate_series(1, 3) g" >/dev/null
SINCE="'2026-11-01T00:00:00Z'"
expect "the two kinds this month, past one response's 1,000 rows" 9.5000 "$(as_role service_role "select public.ai_spend_since_kinds($SINCE, array['sample_reply', 'sample_screen'])")"
expect "one kind alone" 9.000 "$(as_role service_role "select public.ai_spend_since_kinds($SINCE, array['sample_reply'])")"
expect "a kind with no rows is zero, not null" 0 "$(as_role service_role "select public.ai_spend_since_kinds($SINCE, array['golden'])")"
expect "an empty list is zero" 0 "$(as_role service_role "select public.ai_spend_since_kinds($SINCE, array[]::text[])")"
expect "the bound includes a row at exactly since" 9.5060 "$(as_role service_role "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at) values ('edge', 'sample_reply', 'm', 0.006, 1, $SINCE); select public.ai_spend_since_kinds($SINCE, array['sample_reply', 'sample_screen'])")"
expect "ai_spend_since still totals every kind" 10.1400 "$(as_role service_role "select public.ai_spend_since($SINCE)")"
expect "anon refused" denied "$(as_role anon "select public.ai_spend_since_kinds($SINCE, array['sample_reply'])")"
expect "authenticated refused" denied "$(as_role authenticated "select public.ai_spend_since_kinds($SINCE, array['sample_reply'])")"
expect "its own search_path is empty" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'ai_spend_since_kinds'")"
expect "it runs with the caller's rights (security invoker)" 'f' "$(q "select prosecdef from pg_proc where proname = 'ai_spend_since_kinds'")"

say "rollback while rows of the new kinds exist"
expect "refused" refused "$(try_apply "$REPO/supabase/rollback/0029_sample_replies.down.sql" | grep -q "not removing them" && echo refused || echo "went through")"
expect "nothing deleted" 2573 "$(q "select count(*) from ai_calls")"
expect "the function still there" 1 "$(q "select count(*) from pg_proc where proname = 'ai_spend_since_kinds'")"

say "rollback with none, and 0029 again"
q "delete from ai_calls where kind in ('sample_reply', 'sample_screen')" >/dev/null
apply "$REPO/supabase/rollback/0029_sample_replies.down.sql"
expect "function gone" 0 "$(q "select count(*) from pg_proc where proname = 'ai_spend_since_kinds'")"
expect "sample_reply refused again" refused "$(insert_kind r9 sample_reply)"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "back" accepted "$(insert_kind r8 sample_reply)"
expect "and the function" 0.01 "$(as_role service_role "select public.ai_spend_since_kinds('2000-01-01T00:00:00Z', array['sample_reply'])")"

echo
if [ "$FAILED" = 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
