#!/usr/bin/env bash
# Tests 0029_sample_replies.sql and its rollback on a throwaway database on
# a local Postgres:
# - the new kind accepted, an unknown one refused, the four old kinds and
#   every existing row kept, unmarked;
# - the mark held to its kinds: a writing call must carry it, and only a
#   writing call or a screen may;
# - this month's sample spend: every marked call since the UTC month's
#   start, and nothing else (unmarked screens, judge calls, last month's
#   marked calls), past one API response's 1,000 rows and at exactly the
#   month's start; unchanged when a sample's debate is deleted;
# - client roles refused, the server role allowed, an empty search path,
#   the caller's rights;
# - a lock held on ai_calls makes it give up after lock_timeout, changing
#   nothing;
# - a second apply stopping with nothing changed;
# - the rollback refusing while marked calls exist and deleting nothing,
#   and with none restoring the table exactly as it was; and 0029 again;
# - no row rewritten (relfilenode), and an insert that names no mark
#   reading the same before 0029, after it and after the rollback.
#
# The session runs in Pacific/Kiritimati (UTC+14), so a month counted in
# the session's time zone rather than UTC fails the month checks.
#
#   scripts/test-0029-sample-replies.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0029_test_$$"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGTZ=Pacific/Kiritimati

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
  else printf '%s' "$out" | grep -v -E '^(BEGIN|ROLLBACK|SET)?$' | tail -1; fi
}
# insert_call id kind [for_sample]: accepted, or refused by which check.
insert_call() {
  local out cols vals
  if [ -n "${3:-}" ]; then cols=", for_sample"; vals=", $3"; else cols=""; vals=""; fi
  out=$(psql -X -At -d "$DB" -c "insert into ai_calls (id, kind, model, cost_usd, latency_ms$cols) values ('$1', '$2', 'm', 0.01, 1$vals)" 2>&1 || true)
  if printf '%s' "$out" | grep -q 'violates check constraint "ai_calls_kind_check"'; then echo "refused (kind)"
  elif printf '%s' "$out" | grep -q 'violates check constraint "ai_calls_for_sample_check"'; then echo "refused (mark)"
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else echo accepted; fi
}
old_kinds() { echo "$(insert_call "$1"1 judge) $(insert_call "$1"2 golden) $(insert_call "$1"3 judge_allowlist) $(insert_call "$1"4 screen)"; }
table_def() {
  q "select string_agg(conname || ' ' || pg_get_constraintdef(oid), '; ' order by conname) from pg_constraint where conrelid = 'public.ai_calls'::regclass"
  q "select string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'ai_calls'"
}
MONTH="(date_trunc('month', now() at time zone 'utc') at time zone 'utc')"
SPEND="select public.ai_sample_spend_this_month()"

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
BEFORE="$(table_def)"
expect "sample_reply refused" "refused (kind)" "$(insert_call pre1 sample_reply)"
q "insert into debate_topics (slug, title, motion, stances, micro_before, micro_after) values ('t0029', 'T', 'M', '{}'::jsonb, 'b', 'a')" >/dev/null
q "insert into debates (id, topic_slug, school, argument, is_sample) values ('sample-arg', 't0029', 'stoicism', 'words', true)" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at)
   select 'j' || g, 'judge', 'm', 0.02, 1, $MONTH + interval '1 hour' from generate_series(1, 30) g" >/dev/null

say "a lock held on ai_calls"
psql -X -q -d "$DB" -c "begin; lock table ai_calls in access share mode; select pg_sleep(8); commit;" >/dev/null 2>&1 &
HOLDER=$!
sleep 1
LOCKED="$(try_apply "$REPO/supabase/migrations/0029_sample_replies.sql")"
wait "$HOLDER" || true
expect "gives up at lock_timeout" "gave up" "$(printf '%s' "$LOCKED" | grep -q 'lock timeout' && echo 'gave up' || echo "went on: $LOCKED")"
expect "and changes nothing" "$BEFORE" "$(table_def)"

say "0029"
NODE_BEFORE="$(q "select relfilenode from pg_class where oid = 'public.ai_calls'::regclass")"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "no row rewritten" "$NODE_BEFORE" "$(q "select relfilenode from pg_class where oid = 'public.ai_calls'::regclass")"
expect "existing rows kept, unmarked" "30 0" "$(q "select count(*) || ' ' || count(*) filter (where for_sample) from ai_calls")"
expect "a writing call, marked, accepted" accepted "$(insert_call r0 sample_reply true)"
expect "a writing call unmarked refused" "refused (mark)" "$(insert_call r1 sample_reply)"
expect "a screen marked accepted" accepted "$(insert_call s0 screen true)"
expect "a judge call marked refused" "refused (mark)" "$(insert_call j0 judge true)"
expect "the four old kinds accepted, unmarked" "accepted accepted accepted accepted" "$(old_kinds k)"
expect "an unknown kind refused" "refused (kind)" "$(insert_call x1 sample_screen)"
q "delete from ai_calls where id in ('r0', 's0', 'k1', 'k2', 'k3', 'k4')" >/dev/null

# This month: 1,500 marked writing calls at 0.006 and 1,000 marked screens
# at 0.0005 (9.50), the first at exactly the month's start; unmarked
# screens and a judge call on a sample's debate (7.00), which do not
# count; last month's marked calls, which do not either.
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, for_sample)
   select 'r' || g, 'sample_reply', 'm', 0.006, 1, $MONTH + ((g - 1) || ' seconds')::interval, true from generate_series(1, 1500) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, for_sample)
   select 's' || g, 'screen', 'm', 0.0005, 1, $MONTH + interval '2 hours', true from generate_series(1, 1000) g" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, debate_id) values
   ('own1', 'screen', 'm', 1.00, 1, $MONTH + interval '3 hours', null),
   ('own2', 'screen', 'm', 1.00, 1, $MONTH + interval '3 hours', null),
   ('jdg1', 'judge', 'm', 5.00, 1, $MONTH + interval '3 hours', 'sample-arg')" >/dev/null
q "insert into ai_calls (id, kind, model, cost_usd, latency_ms, created_at, for_sample)
   select 'o' || g, 'sample_reply', 'm', 1.00, 1, $MONTH - interval '1 second', true from generate_series(1, 3) g" >/dev/null
expect "this month's marked calls, past one response's 1,000 rows and at exactly its start" 9.5000 "$(as_role service_role "$SPEND")"
expect "ai_spend_since still totals every kind" 17.1000 "$(as_role service_role "select public.ai_spend_since($MONTH)")"
q "delete from ai_calls where id = 'jdg1'; delete from debates where id = 'sample-arg'" >/dev/null
expect "unchanged when a sample's debate is deleted" 9.5000 "$(as_role service_role "$SPEND")"
expect "anon refused" denied "$(as_role anon "$SPEND")"
expect "authenticated refused" denied "$(as_role authenticated "$SPEND")"
expect "its own search_path is empty" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'ai_sample_spend_this_month'")"
expect "it runs with the caller's rights (security invoker)" 'f' "$(q "select prosecdef from pg_proc where proname = 'ai_sample_spend_this_month'")"
expect "it takes no argument" 0 "$(q "select pronargs from pg_proc where proname = 'ai_sample_spend_this_month'")"

say "0029 a second time"
SECOND="$(try_apply "$REPO/supabase/migrations/0029_sample_replies.sql")"
expect "stops at the column" stopped "$(printf '%s' "$SECOND" | grep -q 'column "for_sample" of relation "ai_calls" already exists' && echo stopped || echo "went through: $SECOND")"
expect "nothing changed" 2535 "$(q "select count(*) from ai_calls")"
expect "the function still answers" 9.5000 "$(as_role service_role "$SPEND")"

say "rollback while marked calls exist"
REFUSED="$(try_apply "$REPO/supabase/rollback/0029_sample_replies.down.sql")"
expect "refused" refused "$(printf '%s' "$REFUSED" | grep -q 'not removing them' && echo refused || echo "went through: $REFUSED")"
expect "nothing deleted" 2535 "$(q "select count(*) from ai_calls")"
expect "the function still there" 1 "$(q "select count(*) from pg_proc where proname = 'ai_sample_spend_this_month'")"
q "delete from ai_calls where kind = 'sample_reply'" >/dev/null
REFUSED2="$(try_apply "$REPO/supabase/rollback/0029_sample_replies.down.sql")"
expect "refused while marked screens remain" refused "$(printf '%s' "$REFUSED2" | grep -q 'not removing them' && echo refused || echo "went through: $REFUSED2")"

say "rollback with none, and 0029 again"
q "delete from ai_calls where for_sample" >/dev/null
apply "$REPO/supabase/rollback/0029_sample_replies.down.sql"
expect "function gone" 0 "$(q "select count(*) from pg_proc where proname = 'ai_sample_spend_this_month'")"
expect "the table exactly as before 0029" "$BEFORE" "$(table_def)"
expect "sample_reply refused again" "refused (kind)" "$(insert_call r9 sample_reply)"
expect "the four old kinds still accepted" "accepted accepted accepted accepted" "$(old_kinds m)"
apply "$REPO/supabase/migrations/0029_sample_replies.sql"
expect "back" accepted "$(insert_call r8 sample_reply true)"
expect "and the function" 0.01 "$(as_role service_role "$SPEND")"

echo
if [ "$FAILED" = 0 ]; then echo "all $CHECKS checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
