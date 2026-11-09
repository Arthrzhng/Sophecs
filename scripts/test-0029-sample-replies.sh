#!/usr/bin/env bash
# Tests 0029_sample_replies.sql and its rollback on a throwaway database on
# a local Postgres:
# - the new kind accepted, an unknown one refused, the four old kinds and
#   every existing row kept;
# - the month's sample spend: every sample_reply call and every screen
#   call on a sample's argument, and nothing else (a reader's own screens,
#   a screen on a reader's argument, a judge call on a sample's argument,
#   last month), past one API response's 1,000 rows and at exactly `since`;
# - a null `since` refused rather than read as nothing spent;
# - client roles refused, the server role allowed, an empty search path,
#   the caller's rights;
# - the rollback refusing while sample_reply rows exist and deleting
#   nothing, and with none restoring the constraint exactly as it was;
# - a second apply of 0029 stopping with nothing changed, and 0029 again
#   after the rollback.
#
#   scripts/test-0029-sample-replies.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0029_test_$$"
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
  elif printf '%s' "$out" | grep -q "since is required"; then echo refused
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
old_kinds() { echo "$(insert_kind "$1"1 judge) $(insert_kind "$1"2 golden) $(insert_kind "$1"3 judge_allowlist) $(insert_kind "$1"4 screen)"; }
constraint_def() { q "select pg_get_constraintdef(oid) from pg_constraint where conname = 'ai_calls_kind_check' and conrelid = 'public.ai_calls'::regclass"; }

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
BEFORE="$(constraint_def)"
expect "sample_reply refused" refused "$(insert_kind pre1 sample_reply)"
TOPIC=t0029
q "insert into debate_topics (slug, title, motion, stances, micro_before, micro_after) values ('$TOPIC', 'T', 'M', '{}'::jsonb, 'b', 'a')" >/dev/null
q "insert into debates (id, topic_slug, school, argument, is_sample) values
   ('sample-arg', '$TOPIC', 'stoicism', 'words', true),
   ('reader-arg', '$TOPIC', 'utilitarianism', 'words', false)" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'j' || g, 'judge', 'm', 0.02, 1, '2026-11-02T00:00:00Z' from generate_series(1, 30) g" >/dev/null

say "0029"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "existing rows kept" 30 "$(q "select count(*) from ai_calls")"
expect "sample_reply accepted" accepted "$(insert_kind r0 sample_reply)"
expect "the four old kinds accepted" "accepted accepted accepted accepted" "$(old_kinds k)"
expect "an unknown kind refused" refused "$(insert_kind x1 sample_screen)"
q "delete from ai_calls where id in ('r0', 'k1', 'k2', 'k3', 'k4')" >/dev/null

# This month: 1,500 writing calls at 0.006 and 1,000 screens on the
# sample's argument at 0.0005 (9.50); a reader's own screens, a screen on
# a reader's argument and a judge call on the sample's argument, which do
# not count (7.00); last month's writing calls, which do not either.
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, debate_id)
   select 'r' || g, 'sample_reply', 'm', 0.006, 1, '2026-11-03T00:00:00Z'::timestamptz + (g || ' seconds')::interval, 'sample-arg'
   from generate_series(1, 1500) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, debate_id)
   select 's' || g, 'screen', 'm', 0.0005, 1, '2026-11-03T00:00:00Z', 'sample-arg' from generate_series(1, 1000) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, debate_id) values
   ('own1', 'screen', 'm', 1.00, 1, '2026-11-04T00:00:00Z', null),
   ('own2', 'screen', 'm', 1.00, 1, '2026-11-04T00:00:00Z', 'reader-arg'),
   ('jdg1', 'judge', 'm', 5.00, 1, '2026-11-04T00:00:00Z', 'sample-arg')" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'o' || g, 'sample_reply', 'm', 1.00, 1, '2026-10-20T00:00:00Z' from generate_series(1, 3) g" >/dev/null
SINCE="'2026-11-01T00:00:00Z'"
expect "this month's sample spend, past one response's 1,000 rows" 9.5000 "$(as_role service_role "select public.ai_sample_spend_since($SINCE)")"
expect "the bound includes a call at exactly since" 9.5060 "$(as_role service_role "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at) values ('edge', 'sample_reply', 'm', 0.006, 1, $SINCE); select public.ai_sample_spend_since($SINCE)")"
expect "nothing since is zero, not null" 0 "$(as_role service_role "select public.ai_sample_spend_since('2030-01-01T00:00:00Z')")"
expect "a null since is refused" refused "$(as_role service_role "select public.ai_sample_spend_since(null)")"
expect "ai_spend_since still totals every kind" 17.1000 "$(as_role service_role "select public.ai_spend_since($SINCE)")"
expect "anon refused" denied "$(as_role anon "select public.ai_sample_spend_since($SINCE)")"
expect "authenticated refused" denied "$(as_role authenticated "select public.ai_sample_spend_since($SINCE)")"
expect "its own search_path is empty" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'ai_sample_spend_since'")"
expect "it runs with the caller's rights (security invoker)" 'f' "$(q "select prosecdef from pg_proc where proname = 'ai_sample_spend_since'")"

say "0029 a second time"
SECOND="$(try_apply "$REPO/supabase/migrations/0029_sample_replies.sql")"
expect "stops at create function" stopped "$(printf '%s' "$SECOND" | grep -q 'already exists' && echo stopped || echo "went through: $SECOND")"
expect "nothing changed" 2536 "$(q "select count(*) from ai_calls")"
expect "the function still answers" 9.5000 "$(as_role service_role "select public.ai_sample_spend_since($SINCE)")"

say "rollback while sample_reply rows exist"
REFUSED="$(try_apply "$REPO/supabase/rollback/0029_sample_replies.down.sql")"
expect "refused" refused "$(printf '%s' "$REFUSED" | grep -q 'not removing them' && echo refused || echo "went through: $REFUSED")"
expect "nothing deleted" 2536 "$(q "select count(*) from ai_calls")"
expect "the function still there" 1 "$(q "select count(*) from pg_proc where proname = 'ai_sample_spend_since'")"

say "rollback with none, and 0029 again"
q "delete from ai_calls where kind = 'sample_reply'" >/dev/null
apply "$REPO/supabase/rollback/0029_sample_replies.down.sql"
expect "function gone" 0 "$(q "select count(*) from pg_proc where proname = 'ai_sample_spend_since'")"
expect "the constraint exactly as before 0029" "$BEFORE" "$(constraint_def)"
expect "sample_reply refused again" refused "$(insert_kind r9 sample_reply)"
expect "the four old kinds still accepted" "accepted accepted accepted accepted" "$(old_kinds m)"
expect "the screens on the sample's argument kept" 1000 "$(q "select count(*) from ai_calls where kind = 'screen' and debate_id = 'sample-arg'")"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "back" accepted "$(insert_kind r8 sample_reply)"
expect "and the function" 0.5100 "$(as_role service_role "select public.ai_sample_spend_since('2000-01-01T00:00:00Z')")"

echo
if [ "$FAILED" = 0 ]; then echo "all $CHECKS checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
