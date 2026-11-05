#!/usr/bin/env bash
# Tests 0024_checkpoint_a_database.sql and 0025_drop_unreachable_policies.sql,
# with their rollbacks, on a throwaway database on a local Postgres. Run:
#
#   scripts/test-0024-checkpoint-a-database.sh [port]
#
# It sets Supabase's default privileges and applies every migration before
# 0024, so the grants are production's as 0022 left them. Then:
# - 0024: the display_name check, the class read policies narrowed to the
#   reader's own rows with leaveClass still working, the class functions
#   not executable by clients, elo_percentile with an empty search_path and
#   the same results, exchanges_public not readable by clients;
# - 0024's rollback restores every policy, grant, function and constraint
#   exactly, and 0024 applies again;
# - 0025: the five policies gone, "own update" kept, /me's two signed-in
#   updates still working, the server role's inserts unaffected;
# - 0025's rollback restores the five exactly.
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0024_test_$$"
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
# For the multi-line state dumps: ok, or the lines that differ.
same() {
  if [ "$2" = "$3" ]; then printf '  ok    %s\n' "$1"
  else printf '  FAIL  %s; before (<) and after (>):\n' "$1"; diff <(printf '%s\n' "$2") <(printf '%s\n' "$3") | sed 's/^/        /'; FAILED=1; fi
}
# Runs a statement as a role with auth.uid() set, rolled back, and says
# what happened: the last row of output, or how it was refused.
as_role() {
  local out sub="${3:-}"
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; select set_config('request.jwt.claim.sub', '$sub', true); $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -q "violates check constraint"; then echo check
  elif printf '%s' "$out" | grep -q "row-level security"; then echo rls
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else printf '%s' "$out" | grep -v -E '^(BEGIN|ROLLBACK|SET)?$' | tail -1; fi
}
# Everything 0024 and 0025 touch, as text, to compare before and after.
# ACL entries are sorted: a revoke and re-grant can put the same entries
# back in a different order.
STATE="select string_agg(x, E'\n' order by x) from (
  select 'policy ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '-') || ' ' || coalesce(with_check, '-') as x
    from pg_policies where schemaname = 'public'
  union all
  select 'fn ' || p.proname || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') || ' ' || coalesce((select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) a), '-') || ' ' || md5(p.prosrc)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('elo_percentile', 'is_class_member', 'is_class_owner')
  union all
  select 'acl ' || c.relname || ' ' || coalesce((select string_agg(a::text, ',' order by a::text) from unnest(c.relacl) a), '-')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  union all
  select 'con ' || conrelid::regclass || ' ' || conname from pg_constraint
    where connamespace = 'public'::regnamespace and contype = 'c'
) s"

# The grantor role is cluster-wide, so a run that stopped half way can
# leave it behind; it is cleared before and after.
cleanup() {
  psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true
  psql -X -q -d postgres -c "drop role if exists grantor_0024_test" >/dev/null 2>&1 || true
}
cleanup
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, Supabase's default privileges, every migration before 0024"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on functions to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 24 ] || continue
  apply "$f"
done
q "alter role service_role bypassrls" >/dev/null

OWNER=11111111-1111-4111-8111-111111111111
MEMBER=22222222-2222-4222-8222-222222222222
q "insert into auth.users (id) values ('$OWNER'), ('$MEMBER')" >/dev/null
q "insert into profiles (id, handle, display_name, elo) values ('$OWNER', 'owner', 'Owner', 1250), ('$MEMBER', 'member', 'Member', 1150)" >/dev/null
q "insert into classes (id, code, owner_id, name) values ('c1', 'CODE1', '$OWNER', 'A class')" >/dev/null
q "insert into class_members (class_id, user_id) values ('c1', '$MEMBER')" >/dev/null
# A sample profile rated below everyone, so elo_percentile's "not
# is_sample" is exercised: counted, it would move every percentile.
SAMPLE=33333333-3333-4333-8333-333333333333
q "insert into auth.users (id) values ('$SAMPLE')" >/dev/null
q "insert into profiles (id, handle, display_name, elo, is_sample) values ('$SAMPLE', 'sample', 'Sample', 900, true)" >/dev/null

say "before 0024"
expect "a member reads the class" 1 "$(as_role authenticated "select count(*) from classes where id = 'c1'" "$MEMBER")"
expect "the owner reads the class's members" 1 "$(as_role authenticated "select count(*) from class_members where class_id = 'c1'" "$OWNER")"
expect "signed in, is_class_member runs" t "$(as_role authenticated "select public.is_class_member('c1', '$MEMBER')" "$MEMBER")"
expect "anon reads exchanges_public" 0 "$(as_role anon "select count(*) from exchanges_public")"
expect "elo_percentile has no fixed search_path" "" "$(q "select coalesce(array_to_string(proconfig, ','), '') from pg_proc where proname = 'elo_percentile'")"
PCT_BEFORE=$(q "select elo_percentile(1100) || ' ' || elo_percentile(1200) || ' ' || elo_percentile(1300)")
STATE_BEFORE=$(q "$STATE")

say "0024"
apply "$REPO/supabase/migrations/0024_checkpoint_a_database.sql"
L60=$(printf 'a%.0s' $(seq 1 60)); L61="${L60}a"
expect "61 characters refused" check "$(as_role postgres "update profiles set display_name = '$L61' where id = '$OWNER'")"
expect "60 characters kept" "UPDATE 1" "$(as_role postgres "update profiles set display_name = '$L60' where id = '$OWNER'")"
expect "null kept" "UPDATE 1" "$(as_role postgres "update profiles set display_name = null where id = '$OWNER'")"
expect "signed in, own name over 60 refused" check "$(as_role authenticated "update profiles set display_name = '$L61' where id = '$MEMBER'" "$MEMBER")"
expect "signed in, own name of 60 kept (/me)" "UPDATE 1" "$(as_role authenticated "update profiles set display_name = '$L60' where id = '$MEMBER'" "$MEMBER")"
expect "a member no longer reads the class" 0 "$(as_role authenticated "select count(*) from classes where id = 'c1'" "$MEMBER")"
expect "the owner still reads their class" 1 "$(as_role authenticated "select count(*) from classes where id = 'c1'" "$OWNER")"
expect "the owner no longer reads others' memberships" 0 "$(as_role authenticated "select count(*) from class_members where class_id = 'c1'" "$OWNER")"
expect "a member reads their own membership" 1 "$(as_role authenticated "select count(*) from class_members where class_id = 'c1'" "$MEMBER")"
expect "leaveClass still deletes the member's own row" "DELETE 1" "$(as_role authenticated "delete from class_members where class_id = 'c1' and user_id = '$MEMBER'" "$MEMBER")"
expect "signed in, is_class_member refused" denied "$(as_role authenticated "select public.is_class_member('c1', '$MEMBER')" "$MEMBER")"
expect "signed in, is_class_owner refused" denied "$(as_role authenticated "select public.is_class_owner('c1', '$OWNER')" "$OWNER")"
expect "anon, is_class_member refused" denied "$(as_role anon "select public.is_class_member('c1', '$MEMBER')")"
expect "the server role still reads every class" 1 "$(as_role service_role "select count(*) from classes")"
expect "elo_percentile's search_path" 'search_path=""' "$(q "select array_to_string(proconfig, ',') from pg_proc where proname = 'elo_percentile'")"
expect "before 0024, elo_percentile counts genuine profiles only" "0.00000000000000000000 0.50000000000000000000 1.00000000000000000000" "$PCT_BEFORE"
expect "elo_percentile's results unchanged" "$PCT_BEFORE" "$(q "select elo_percentile(1100) || ' ' || elo_percentile(1200) || ' ' || elo_percentile(1300)")"
# Called with no search_path at all, so the body must name its table in
# full. (As anon it would return 0 either way: it runs with the caller's
# rights, and row level security shows anon no profiles.)
expect "elo_percentile runs under an empty caller search_path" "$(q "select elo_percentile(1200)")" "$(q "set search_path = ''; select public.elo_percentile(1200)" | tail -1)"
expect "anon reads exchanges_public" denied "$(as_role anon "select count(*) from exchanges_public")"
expect "signed in, reads exchanges_public" denied "$(as_role authenticated "select count(*) from exchanges_public" "$MEMBER")"
expect "the server role reads exchanges_public" 0 "$(as_role service_role "select count(*) from exchanges_public")"
expect "debates_public still readable" 0 "$(as_role anon "select count(*) from debates_public")"

say "0024's rollback, then 0024 again"
apply "$REPO/supabase/rollback/0024_checkpoint_a_database.down.sql"
same "every policy, grant, function and constraint as before" "$STATE_BEFORE" "$(q "$STATE")"
expect "a member reads the class again" 1 "$(as_role authenticated "select count(*) from classes where id = 'c1'" "$MEMBER")"

say "0024's closing check fails on a privilege another role granted"
q "create role grantor_0024_test nologin" >/dev/null
q "grant execute on function public.is_class_owner(text, uuid) to grantor_0024_test with grant option" >/dev/null
q "set role grantor_0024_test; grant execute on function public.is_class_owner(text, uuid) to authenticated; reset role" >/dev/null
OUT=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/migrations/0024_checkpoint_a_database.sql" 2>&1 || true)
expect "0024 is refused, naming it" yes "$(printf '%s' "$OUT" | grep -q 'authenticated EXECUTE on is_class_owner' && echo yes || echo no)"
same "and changes nothing" "$STATE_BEFORE" "$(q "$STATE" | sed 's/,grantor_0024_test=X\*\/postgres//; s/authenticated=X\/grantor_0024_test,//')"
q "set role grantor_0024_test; revoke execute on function public.is_class_owner(text, uuid) from authenticated; reset role" >/dev/null
q "revoke execute on function public.is_class_owner(text, uuid) from grantor_0024_test cascade; drop role grantor_0024_test" >/dev/null

say "0024's closing check fails on any other policy that calls a class function"
q "create policy stray_0024_test on debates for select using (public.is_class_member('c1', auth.uid()))" >/dev/null
OUT=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/migrations/0024_checkpoint_a_database.sql" 2>&1 || true)
expect "0024 is refused, naming the policy" yes "$(printf '%s' "$OUT" | grep -q 'policies still call the class functions: debates "stray_0024_test"' && echo yes || echo no)"
same "and changes nothing" "$STATE_BEFORE" "$(q "$STATE" | grep -v stray_0024_test)"
q "drop policy stray_0024_test on debates" >/dev/null
apply "$REPO/supabase/migrations/0024_checkpoint_a_database.sql"
expect "0024 applies again" denied "$(as_role authenticated "select public.is_class_member('c1', '$MEMBER')" "$MEMBER")"
STATE_BEFORE_0025=$(q "$STATE")

say "0025"
apply "$REPO/supabase/migrations/0025_drop_unreachable_policies.sql"
expect "the five dropped" 0 "$(q "select count(*) from pg_policies where schemaname = 'public' and ((tablename, policyname) in (('debates', 'debates insert own'), ('profiles', 'own insert'), ('challenges', 'anon insert own'), ('quiz_results', 'anon insert own'), ('class_members', 'member join self')))")"
expect "own update kept" 1 "$(q "select count(*) from pg_policies where tablename = 'profiles' and policyname = 'own update'")"
expect "/me: setDisplayName still writes" "UPDATE 1" "$(as_role authenticated "update profiles set display_name = 'Renamed' where id = '$MEMBER'" "$MEMBER")"
expect "/me: setArgumentDefaultPublic still writes" "UPDATE 1" "$(as_role authenticated "update profiles set argument_default_public = true where id = '$MEMBER'" "$MEMBER")"
expect "signed in, still no insert into debates" denied "$(as_role authenticated "insert into debates (user_id, topic_slug, school, argument) values ('$MEMBER', 't', 'stoicism', 'x')" "$MEMBER")"
expect "the server role still joins a class (joinClass)" "INSERT 0 1" "$(as_role service_role "insert into class_members (class_id, user_id) values ('c1', '$OWNER')")"

say "0025's rollback"
apply "$REPO/supabase/rollback/0025_drop_unreachable_policies.down.sql"
same "the five back exactly" "$STATE_BEFORE_0025" "$(q "$STATE")"

echo
if [ "$FAILED" = 0 ]; then echo "all checks passed"; else echo "SOME CHECKS FAILED"; exit 1; fi
