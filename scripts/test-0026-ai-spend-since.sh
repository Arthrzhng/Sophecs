#!/usr/bin/env bash
# Tests 0026_ai_spend_since.sql and its rollback on a throwaway database on
# a local Postgres: the sum over more rows than one API response returns,
# the date bound, no rows, client roles refused and the server role
# allowed, the rollback, and a second apply.
#
#   scripts/test-0026-ai-spend-since.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0026_test_$$"
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
  else printf '%s' "$out" | grep -v -E '^(BEGIN|ROLLBACK|SET)?$' | tail -1; fi
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0026"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 26 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null

say "1,500 calls this month at 0.01, 7 last month at 1.00"
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'n' || g, 'judge', 'm', 0.01, 1, '2026-11-02T00:00:00Z'::timestamptz + (g || ' seconds')::interval
   from generate_series(1, 1500) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'o' || g, 'judge', 'm', 1.00, 1, '2026-10-20T00:00:00Z' from generate_series(1, 7) g" >/dev/null

say "0026"
apply "$REPO/supabase/migrations/0026_ai_spend_since.sql"
expect "every row this month, past one response's 1,000" 15.00 "$(as_role service_role "select public.ai_spend_since('2026-11-01T00:00:00Z')")"
expect "the bound includes a row at exactly since" 15.01 "$(as_role service_role "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at) values ('edge', 'judge', 'm', 0.01, 1, '2026-11-01T00:00:00Z'); select public.ai_spend_since('2026-11-01T00:00:00Z')")"
expect "nothing since is zero, not null" 0 "$(as_role service_role "select public.ai_spend_since('2030-01-01T00:00:00Z')")"
expect "anon refused" denied "$(as_role anon "select public.ai_spend_since('2026-11-01T00:00:00Z')")"
expect "authenticated refused" denied "$(as_role authenticated "select public.ai_spend_since('2026-11-01T00:00:00Z')")"
expect "its own search_path is empty" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'ai_spend_since'")"

say "rollback, and 0026 again"
apply "$REPO/supabase/rollback/0026_ai_spend_since.down.sql"
expect "gone" 0 "$(q "select count(*) from pg_proc where proname = 'ai_spend_since'")"
apply "$REPO/supabase/migrations/0026_ai_spend_since.sql"
expect "back" 15.00 "$(as_role service_role "select public.ai_spend_since('2026-11-01T00:00:00Z')")"

echo
if [ "$FAILED" = 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
