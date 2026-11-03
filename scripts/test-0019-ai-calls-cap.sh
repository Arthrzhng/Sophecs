#!/usr/bin/env bash
# Proves migration 0019 on a throwaway local database:
#
# - every ai_calls row that exists before it keeps counting toward the
#   daily cap (counts_toward_cap true) with no validation error, and its
#   cost is untouched, so the cap and the monthly budget count exactly what
#   they counted before;
# - the table is not rewritten (its file node is unchanged);
# - a row taken out of the cap drops out of the route's cap count and stays
#   in the budget's sum;
# - the rollback removes both columns and keeps every row and its cost,
#   and the migration applies again after it.
#
# Usage: scripts/test-0019-ai-calls-cap.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0019_test_$$"
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

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim and every migration before 0019"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 19 ] || continue
  apply "$f"
done

say "ai_calls rows as they are before 0019"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'ROWS'
insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555');
insert into ai_calls (id, user_id, kind, model, cost_usd, latency_ms, created_at) values
 ('c1','55555555-5555-5555-5555-555555555555','judge','m',0.010,5000, now() - interval '1 hour'),
 ('c2','55555555-5555-5555-5555-555555555555','judge','m',0.011,5000, now() - interval '2 hours'),
 ('c3','55555555-5555-5555-5555-555555555555','judge_allowlist','m',0.012,5000, now() - interval '3 hours'),
 ('c4','55555555-5555-5555-5555-555555555555','judge','m',0.013,5000, now() - interval '30 hours'),
 ('c5', null,'golden','m',0.014,5000, now());
ROWS
cap_before=$(q "select count(*) from ai_calls where user_id = '55555555-5555-5555-5555-555555555555' and kind = 'judge' and created_at >= now() - interval '24 hours'")
sum_before=$(q "select sum(cost_usd) from ai_calls")
node_before=$(q "select relfilenode from pg_class where oid = 'public.ai_calls'::regclass")
expect "cap count before 0019" 2 "$cap_before"

say "apply 0019"
apply "$REPO/supabase/migrations/0019_ai_calls_cap_and_validation.sql"
expect "counts_toward_cap type" "boolean|NO|true" "$(q "select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns where table_name = 'ai_calls' and column_name = 'counts_toward_cap'")"
expect "validation_error type" "text|YES|" "$(q "select data_type || '|' || is_nullable || '|' || coalesce(column_default, '') from information_schema.columns where table_name = 'ai_calls' and column_name = 'validation_error'")"
expect "every existing row still counts" "5" "$(q "select count(*) from ai_calls where counts_toward_cap")"
expect "no existing row has a validation error" "0" "$(q "select count(*) from ai_calls where validation_error is not null")"
expect "costs untouched" "$sum_before" "$(q "select sum(cost_usd) from ai_calls")"
expect "table not rewritten" "$node_before" "$(q "select relfilenode from pg_class where oid = 'public.ai_calls'::regclass")"
cap_query="select count(*) from ai_calls where user_id = '55555555-5555-5555-5555-555555555555' and kind = 'judge' and counts_toward_cap and created_at >= now() - interval '24 hours'"
expect "the route's cap query counts what it counted before" "$cap_before" "$(q "$cap_query")"

say "a failed submission: written, then taken out of the cap"
q "insert into ai_calls (id, user_id, kind, model, cost_usd, latency_ms, validation_error) values
   ('f1','55555555-5555-5555-5555-555555555555','judge','m',0.020,5000,'verdict_line: verdict_line exceeds 20 words'),
   ('f2','55555555-5555-5555-5555-555555555555','judge','m',0.021,5000,'verdict_line: verdict_line exceeds 20 words')" >/dev/null
expect "new rows count by default" "4" "$(q "$cap_query")"
q "update ai_calls set counts_toward_cap = false where id in ('f1','f2')" >/dev/null
expect "taken out of the cap" "$cap_before" "$(q "$cap_query")"
expect "still in the budget's sum" "0.101" "$(q "select sum(cost_usd) from ai_calls")"
expect "validation error kept" "2" "$(q "select count(*) from ai_calls where validation_error like 'verdict_line:%'")"

say "rollback"
apply "$REPO/supabase/rollback/0019_ai_calls_cap_and_validation.down.sql"
expect "columns gone" "0" "$(q "select count(*) from information_schema.columns where table_name = 'ai_calls' and column_name in ('counts_toward_cap','validation_error')")"
expect "every row kept" "7" "$(q "select count(*) from ai_calls")"
expect "every cost kept" "0.101" "$(q "select sum(cost_usd) from ai_calls")"

say "apply again"
apply "$REPO/supabase/migrations/0019_ai_calls_cap_and_validation.sql"
expect "re-applied: every row counts again" "7" "$(q "select count(*) from ai_calls where counts_toward_cap")"

if [ "$FAILED" -eq 0 ]; then say "all checks passed"; else say "SOME CHECKS FAILED"; exit 1; fi
