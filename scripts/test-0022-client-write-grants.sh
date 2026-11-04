#!/usr/bin/env bash
# Proves migration 0022 on a throwaway local database, under the grants
# production has: Supabase's default privileges give anon, authenticated
# and service_role every privilege on what is made in `public`, and this
# script sets the same default before applying the migrations.
#
# - before 0022, each write it closes goes through, as anon or as a
#   signed-in user, the way the Data API would send it;
# - after it, each is refused, and every write and read the site makes
#   with a client key still works, as do the server role's writes;
# - each object's privileges after 0022 are exactly the ones meant;
# - the rollback restores each object's privileges as they were, and 0022
#   applies again;
# - a privilege the REVOKE cannot take (granted by another role) makes
#   0022 fail as a whole, changing nothing.
#
# Postgres 16 has no MAINTAIN, so on it the MAINTAIN half of 0022 and of
# its rollback is a no-op and its checks print as skipped. Production runs
# Postgres 17: there, 0022's own closing check fails the migration if
# MAINTAIN is left, and the read-back confirms it. The rollback's MAINTAIN
# half is not tested anywhere.
#
# Usage: scripts/test-0022-client-write-grants.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0022g_test_$$"
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
# how many rows it reached (the command tag's count, or a count(*)'s
# value), or "denied" for a missing table privilege. Any other error, a
# missing schema or function privilege included, prints as itself, so a
# check cannot pass on a typo. No RETURNING: it would make the
# select policy narrow what an update reaches.
R=11111111-1111-4111-8111-111111111111   # a signed-in reader with a profile
T=22222222-2222-4222-8222-222222222222   # a signed-in reader with no profile yet
S=33333333-3333-4333-8333-333333333333   # a class owner
ANON=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
reach() {
  local out
  out=$(psql -X -At -v ON_ERROR_STOP=1 -d "$DB" -c "begin; set local role $1; select set_config('request.jwt.claim.sub', '${3:-}', true); select set_config('request.headers', '{\"x-anon-id\": \"$ANON\"}', true); $2; rollback;" 2>&1) || {
    if printf '%s' "$out" | grep -qE 'permission denied for (table|view) '; then echo denied
    else echo "error: $(printf '%s' "$out" | grep ERROR)"; fi
    return
  }
  printf '%s\n' "$out" | grep -v '^ROLLBACK$' | tail -1 | awk '{print $NF}'
}
# Each object's ACL as sorted entries, and the column ACLs on profiles.
TABLES="debates challenges quiz_results profiles class_members"
VIEWS="debates_public exchanges_public profiles_public public_results"
acls() {
  q "select string_agg(c.relname || ':' || coalesce((select string_agg(a::text, ',' order by a::text) from unnest(c.relacl) a), '-'), ' ' order by c.relname)
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ($(printf "'%s'," $TABLES $VIEWS | sed 's/,$//'))"
  q "select coalesce(string_agg(attname || ':' || attacl::text, ' ' order by attname), 'none') from pg_attribute
      where attrelid = 'public.profiles'::regclass and attacl is not null"
}
cleanup() {
  psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true
  # A role is cluster-wide: drop it once no database refers to it.
  psql -X -q -d postgres -c "drop role if exists grantor_0022_test" >/dev/null 2>&1 || true
}
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
PG17=$(q "select current_setting('server_version_num')::int >= 170000")

say "shim, Supabase's default privileges, every migration before 0022"
apply "$REPO/scripts/local-auth-shim.sql"
q "grant usage on schema auth to anon, authenticated, service_role" >/dev/null
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 22 ] || continue
  apply "$f"
done

psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<ROWS
insert into auth.users (id) values ('$R'), ('$T'), ('$S');
insert into profiles (id, display_name) values ('$R', 'R'), ('$S', 'S');
insert into debate_topics (slug, title, motion, stances, micro_before, micro_after)
  values ('t1', 'T', 'M', '{}', 'a', 'b');
insert into quiz_results (id, school, vector, answers, anon_id, user_id) values
  ('rmine', 'stoicism', '{}', '[]', '$ANON', '$R'),
  ('rother', 'stoicism', '{}', '[]', gen_random_uuid(), null);
insert into challenges (id, challenger_result_id) values ('c1', 'rmine');
insert into debates (id, user_id, topic_slug, school, argument) values ('d1', '$R', 't1', 'stoicism', 'An argument.');
insert into classes (id, code, owner_id, name) values ('k1', 'CODE01', '$S', 'One'), ('k2', 'CODE02', '$S', 'Two');
insert into class_members (class_id, user_id) values ('k1', '$R');
ROWS

ACL_BEFORE=$(acls)

# The writes 0022 closes, each as the Data API would send it.
DEBATE_INSERT="insert into debates (id, user_id, topic_slug, school, argument, verdict, score, elo_after) values ('d9', '$R', 't1', 'stoicism', 'Mine.', '{\"score\": 100}', 100, 3000)"
OWN_RATING="update profiles set elo = 3000, streak = 99, school = 'utilitarianism' where id = '$R'"
OWN_PROFILE="insert into profiles (id, elo, school) values ('$T', 3000, 'stoicism')"
QUIZ_INSERT="insert into quiz_results (id, school, vector, answers, anon_id) values ('r9', 'stoicism', '{}', '[]', gen_random_uuid())"
CHALLENGE_INSERT="insert into challenges (id, challenger_result_id) values ('c9', 'rother')"
JOIN_WITHOUT_CODE="insert into class_members (class_id, user_id) values ('k2', '$R')"
closed() {
  expect "$1: a reader inserts a debate with its own verdict" "$2" "$(reach authenticated "$DEBATE_INSERT" $R)"
  expect "$1: a reader sets their own rating, streak and school" "$2" "$(reach authenticated "$OWN_RATING" $R)"
  expect "$1: a reader with no profile creates one with any rating" "$2" "$(reach authenticated "$OWN_PROFILE" $T)"
  expect "$1: anyone inserts a quiz result" "$2" "$(reach anon "$QUIZ_INSERT")"
  expect "$1: anyone inserts a challenge naming another's result" "$2" "$(reach anon "$CHALLENGE_INSERT")"
  expect "$1: a reader joins a class without its code" "$2" "$(reach authenticated "$JOIN_WITHOUT_CODE" $R)"
}

say "before 0022: the writes it closes go through"
closed "before" 1

# Every write and read the site makes with a client key (src/app/me/actions.ts,
# src/app/debate/actions.ts), and the server role's writes.
kept() {
  expect "$1: setDisplayName" 1 "$(reach authenticated "update profiles set display_name = 'New' where id = '$R'" $R)"
  expect "$1: setArgumentDefaultPublic" 1 "$(reach authenticated "update profiles set argument_default_public = true where id = '$R'" $R)"
  expect "$1: leaveClass" 1 "$(reach authenticated "delete from class_members where class_id = 'k1' and user_id = '$R'" $R)"
  expect "$1: saveReadingResponse (an upsert)" 1 "$(reach authenticated "insert into reading_responses (id, user_id, topic_slug, chunk_index, response) values ('rr1', '$R', 't1', 0, 'Yes.') on conflict (user_id, topic_slug, chunk_index) do update set response = excluded.response" $R)"
  expect "$1: a reader reads their own profile" 1 "$(reach authenticated "select count(*) from profiles where id = '$R'" $R)"
  expect "$1: a reader reads their own debates" 1 "$(reach authenticated "select count(*) from debates" $R)"
  expect "$1: a party reads its challenge" 1 "$(reach authenticated "select count(*) from challenges" $R)"
  expect "$1: a browser reads its own quiz result" 1 "$(reach anon "select count(*) from quiz_results")"
  expect "$1: a member reads their membership" 1 "$(reach authenticated "select count(*) from class_members" $R)"
  expect "$1: anon reads debates_public" 1 "$(reach anon "select count(*) from debates_public")"
  expect "$1: anon reads public_results" 2 "$(reach anon "select count(*) from public_results")"
  expect "$1: the server role inserts a debate" 1 "$(reach service_role "$DEBATE_INSERT")"
  expect "$1: the server role sets a rating" 1 "$(reach service_role "$OWN_RATING")"
  expect "$1: the server role inserts a quiz result" 1 "$(reach service_role "$QUIZ_INSERT")"
  expect "$1: the server role inserts a challenge" 1 "$(reach service_role "$CHALLENGE_INSERT")"
  expect "$1: the server role adds a member" 1 "$(reach service_role "$JOIN_WITHOUT_CODE")"
}
kept "before"

say "apply 0022"
apply "$REPO/supabase/migrations/0022_client_write_grants.sql"

say "after 0022: closed"
closed "after" denied
expect "after: a reader sets their name and rating in one update" denied "$(reach authenticated "update profiles set display_name = 'New', elo = 3000 where id = '$R'" $R)"
expect "after: anon updates a profile column it may not" denied "$(reach anon "update profiles set display_name = 'x' where id = '$R'")"
expect "after: anon leaves a class" denied "$(reach anon "delete from class_members where class_id = 'k1'")"
expect "after: a reader deletes their debate" denied "$(reach authenticated "delete from debates where id = 'd1'" $R)"

say "after 0022: what the site uses still works"
kept "after"

say "after 0022: privileges"
# Owner and service_role keep everything; anon and authenticated read;
# authenticated keeps DELETE on class_members and two columns of profiles.
if [ "$PG17" = t ]; then ALL=arwdDxtm; else ALL=arwdDxt; fi
P="postgres=$ALL/postgres,service_role=$ALL/postgres"
expect "table and view ACLs" \
  "challenges:anon=r/postgres,authenticated=r/postgres,$P class_members:anon=r/postgres,authenticated=rd/postgres,$P debates:anon=r/postgres,authenticated=r/postgres,$P debates_public:anon=r/postgres,authenticated=r/postgres,$P exchanges_public:anon=r/postgres,authenticated=r/postgres,$P profiles:anon=r/postgres,authenticated=r/postgres,$P profiles_public:$P public_results:anon=r/postgres,authenticated=r/postgres,$P quiz_results:anon=r/postgres,authenticated=r/postgres,$P" \
  "$(acls | head -1)"
expect "column grants on profiles" "argument_default_public:{authenticated=w/postgres} display_name:{authenticated=w/postgres}" "$(acls | tail -1)"
if [ "$PG17" = t ]; then
  expect "no MAINTAIN left with anon or authenticated on the nine" 0 "$(q "select count(*) from pg_class c, aclexplode(c.relacl) a where c.relnamespace = 'public'::regnamespace and c.relname in ($(printf "'%s'," $TABLES $VIEWS | sed 's/,$//')) and a.grantee in ('anon'::regrole, 'authenticated'::regrole) and a.privilege_type = 'MAINTAIN'")"
else
  printf '  skip  MAINTAIN: Postgres %s has none\n' "$(q "show server_version")"
fi
expect "no row changed" "1|1|2|2|1|1" "$(q "select (select count(*) from debates) || '|' || (select count(*) from challenges) || '|' || (select count(*) from quiz_results) || '|' || (select count(*) from profiles) || '|' || (select count(*) from class_members) || '|' || (select count(*) from profiles where elo = 1200 and display_name = 'R')")"

say "rollback"
apply "$REPO/supabase/rollback/0022_client_write_grants.down.sql"
expect "every ACL as before 0022" "$ACL_BEFORE" "$(acls)"
closed "rolled back" 1

say "0022 again"
apply "$REPO/supabase/migrations/0022_client_write_grants.sql"
closed "re-applied" denied
kept "re-applied"

say "a privilege REVOKE cannot take makes 0022 fail, changing nothing"
# As if a role other than the owner had granted it (production's default
# privileges name supabase_admin as a grantor for objects it owns): the
# owner's REVOKE does not take another grantor's grant.
apply "$REPO/supabase/rollback/0022_client_write_grants.down.sql"
q "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'grantor_0022_test') then create role grantor_0022_test nologin; end if; end \$\$" >/dev/null
q "grant insert on public.debates to grantor_0022_test with grant option" >/dev/null
q "set role grantor_0022_test; grant insert on public.debates to anon" >/dev/null
ACL_STUCK=$(acls)
OUT=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/migrations/0022_client_write_grants.sql" 2>&1 || true)
expect "0022 stops on it, naming it" 1 "$(printf '%s' "$OUT" | grep -c 'still held after the revokes: anon INSERT on debates')"
expect "and changes nothing" "$ACL_STUCK" "$(acls)"
q "revoke all on public.debates from grantor_0022_test cascade" >/dev/null
expect "with that grant gone, 0022 applies" "" "$(apply "$REPO/supabase/migrations/0022_client_write_grants.sql" 2>&1)"

if [ "$FAILED" -ne 0 ]; then echo; echo "== FAILED =="; exit 1; fi
echo; echo "== all checks passed =="
