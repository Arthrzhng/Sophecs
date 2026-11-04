#!/usr/bin/env bash
# Proves migration 0021 on a throwaway local database, under the grants
# 0016 left in production (as far as Postgres 16 has them; production runs
# 17, see test-0020-motion-text-view.sh):
#
# - every existing row stays genuine (is_sample false), and nothing about
#   debates_public or public_results changes but the appended columns:
#   same rows, same redaction, same owner and grants;
# - only the server role can set or clear the marker, and anon and
#   authenticated can neither read nor write the registry;
# - a row can be owned by one seed run only;
# - elo_percentile counts genuine profiles only;
# - the rollback refuses while a sample row remains, then returns both
#   views to their earlier definitions, as text, with the same grants;
# - 0021 applies again after it.
#
# Usage: scripts/test-0021-sample-activity.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0021_test_$$"
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
# Runs SQL as a role, with an optional signed-in user id, inside a
# transaction that is rolled back. Prints allowed, denied, or the error.
as_role() {
  local out sub="${3:-}"
  out=$(psql -X -At -d "$DB" -c "begin; set local role $1; select set_config('request.jwt.claim.sub', '$sub', true); $2; rollback;" 2>&1 || true)
  if printf '%s' "$out" | grep -q "permission denied"; then echo denied
  elif printf '%s' "$out" | grep -q "is_sample is set only by the seed tooling"; then echo guarded
  elif printf '%s' "$out" | grep -q "row-level security"; then echo rls
  elif printf '%s' "$out" | grep -qi "error"; then echo "error: $out"
  else echo allowed; fi
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, every migration before 0021, production's grants"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 21 ] || continue
  case "$(basename "$f")" in 0016_*)
    for v in debates_public exchanges_public profiles_public public_results; do
      q "grant all on public.$v to anon, authenticated, service_role" >/dev/null
    done
    for t in debates profiles quiz_results challenges exchanges; do
      q "grant all on public.$t to service_role" >/dev/null
    done ;;
  esac
  apply "$f"
done
# Supabase's default privileges: anything new in public is granted to all
# three roles. 0021's registry tables must not keep what this grants. The
# tables made before this point get the same grants by hand, as they have
# in production, so that row level security and the guard are what decide.
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
for t in debates profiles quiz_results challenges exchanges classes class_members blocks reports turns; do
  q "grant all on public.$t to anon, authenticated, service_role" >/dev/null
done
# Supabase's service_role bypasses row level security. The shim creates it
# so, but a role is cluster-wide and an older shim may have made it without.
q "alter role service_role bypassrls" >/dev/null

U=55555555-5555-5555-5555-555555555555
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<ROWS
insert into auth.users (id) values ('$U');
insert into profiles (id, handle, display_name, school, elo, streak)
  values ('$U', 'genuine', 'Genuine Reader', 'stoicism', 1100, 0);
insert into debate_topics (slug,title,motion,stances,micro_before,micro_after,sort,active)
  values ('st','ST','A motion.','{}'::jsonb,'a','b',99,true);
insert into debates (id,user_id,topic_slug,school,argument,argument_public,score,kind,verdict,motion_text) values
 ('gpriv','$U','st','stoicism','secret words',false,72,'original',
  '{"rejected":false,"score":72,"fidelity":7,"rigor":7,"engagement":6,
    "strongest_move":"quotes secret words","verdict_line":"secret words",
    "unanswered_objection":{"school":"utilitarianism","claim":"secret","why_it_stands":"secret"},
    "prompt_version":"v2"}','The motion.'),
 ('gpub','$U','st','stoicism','open words',true,70,'original',
  '{"rejected":false,"score":70,"fidelity":7,"rigor":7,"engagement":6,"verdict_line":"open","prompt_version":"v2"}','The motion.');
insert into quiz_results (id, school, secondary, vector, answers, anon_id)
  values ('gquiz','stoicism','utilitarianism','{}'::jsonb,'[]'::jsonb, gen_random_uuid());
ROWS

viewdef() { q "select pg_get_viewdef('public.$1'::regclass, true)"; }
meta() { q "select pg_get_userbyid(c.relowner) || ' | ' || coalesce(c.reloptions::text, '-') || ' | ' || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x), '-') from pg_class c where c.oid = 'public.$1'::regclass"; }
cols() { q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = '$1'"; }
dp_digest() { q "select md5(string_agg(row(id, topic_slug, school, score, verdict, elo_before, elo_after, created_at, kind, parent_debate_id, argument, motion_text)::text, '|' order by id)) from debates_public"; }
pr_digest() { q "select md5(string_agg(row(id, school, secondary, vector, challenge_from, created_at)::text, '|' order by id)) from public_results"; }

say "before 0021"
DP_COLS="$(cols debates_public)"; PR_COLS="$(cols public_results)"
DP_DEF="$(viewdef debates_public)"; PR_DEF="$(viewdef public_results)"
DP_META="$(meta debates_public)"; PR_META="$(meta public_results)"
DP_DIGEST="$(dp_digest)"; PR_DIGEST="$(pr_digest)"
PCT_BEFORE="$(q "select elo_percentile(1150)")"
echo "  debates_public: $DP_META"
echo "  public_results: $PR_META"
echo "  elo_percentile(1150) = $PCT_BEFORE"

say "apply 0021"
apply "$REPO/supabase/migrations/0021_sample_activity.sql"

after() {
  expect "$1: debates_public columns" "$DP_COLS,is_sample,verdict_is_template" "$(cols debates_public)"
  expect "$1: public_results columns" "$PR_COLS,is_sample" "$(cols public_results)"
  expect "$1: debates_public rows unchanged" "$DP_DIGEST" "$(dp_digest)"
  expect "$1: public_results rows unchanged" "$PR_DIGEST" "$(pr_digest)"
  expect "$1: debates_public owner and grants" "$DP_META" "$(meta debates_public)"
  expect "$1: public_results owner and grants" "$PR_META" "$(meta public_results)"
  expect "$1: a private argument is still hidden" "" "$(q "select argument from debates_public where id = 'gpriv'")"
  expect "$1: no secret in any public verdict" 0 "$(q "select count(*) from debates_public where verdict::text like '%secret%'")"
  for t in profiles quiz_results debates challenges exchanges; do
    expect "$1: $t.is_sample not null default false" "NO false" "$(q "select is_nullable || ' ' || column_default from information_schema.columns where table_schema='public' and table_name='$t' and column_name='is_sample'")"
  done
  expect "$1: every existing row is genuine" 0 "$(q "select (select count(*) from profiles where is_sample) + (select count(*) from debates where is_sample) + (select count(*) from quiz_results where is_sample)")"
  expect "$1: verdict_is_template false on existing rows" 0 "$(q "select count(*) from debates where verdict_is_template")"
  for r in anon authenticated; do
    for t in seed_runs seed_run_items; do
      for p in SELECT INSERT UPDATE DELETE TRUNCATE; do
        expect "$1: $r $p $t" f "$(q "select has_table_privilege('$r', 'public.$t', '$p')")"
      done
    done
    expect "$1: $r reads seed_runs" denied "$(as_role $r "select * from public.seed_runs")"
  done
  expect "$1: service_role reads seed_runs" allowed "$(as_role service_role "select * from public.seed_runs")"
  expect "$1: seed_runs has row level security" t "$(q "select relrowsecurity from pg_class where oid = 'public.seed_runs'::regclass")"
  expect "$1: seed_run_items has row level security" t "$(q "select relrowsecurity from pg_class where oid = 'public.seed_run_items'::regclass")"
  expect "$1: debates has a created_at index" 1 "$(q "select count(*) from pg_indexes where schemaname='public' and indexname='debates_created_at_idx'")"
}
after "after 0021"

say "the marker: only the server role sets or clears it"
# A signed-in reader's own profile update, which the "own update" policy
# allows, must not be able to touch the marker.
expect "authenticated updates own display_name" allowed "$(as_role authenticated "update profiles set display_name = 'New' where id = '$U'" "$U")"
expect "authenticated sets own is_sample" guarded "$(as_role authenticated "update profiles set is_sample = true where id = '$U'" "$U")"
expect "anon inserts a sample quiz result" guarded "$(as_role anon "insert into quiz_results (id, school, vector, answers, anon_id, is_sample) values ('aq','stoicism','{}','[]', gen_random_uuid(), true)")"
expect "anon inserts a genuine quiz result" allowed "$(as_role anon "insert into quiz_results (id, school, vector, answers, anon_id) values ('aq2','stoicism','{}','[]', gen_random_uuid())")"
expect "anon inserts a sample challenge" guarded "$(as_role anon "insert into challenges (id, challenger_result_id, is_sample) values ('ac','gquiz', true)")"
expect "service_role inserts a sample quiz result" allowed "$(as_role service_role "insert into quiz_results (id, school, vector, answers, anon_id, is_sample) values ('sq','stoicism','{}','[]', gen_random_uuid(), true)")"
expect "service_role clears a marker" allowed "$(as_role service_role "update quiz_results set is_sample = false where id = 'gquiz'")"

say "the registry: one owner per row"
q "insert into seed_runs (id, status, plan_hash, generator_version, seed, window_from, window_to) values ('run-aaaaaa','running','h','g',1,now(),now()), ('run-bbbbbb','running','h','g',1,now(),now())" >/dev/null
q "insert into seed_run_items (run_id, kind, logical_id, row_id, state) values ('run-aaaaaa','debate','d1','row1','created')" >/dev/null
dup=$(psql -X -d "$DB" -c "insert into seed_run_items (run_id, kind, logical_id, row_id, state) values ('run-bbbbbb','debate','d9','row1','created')" 2>&1 || true)
expect "a second run claiming the same row" refused "$(printf '%s' "$dup" | grep -q 'seed_run_items_row' && echo refused || echo "$dup")"
bad=$(psql -X -d "$DB" -c "insert into seed_runs (id, status, plan_hash, generator_version, seed, window_from, window_to) values ('Bad Id','running','h','g',1,now(),now())" 2>&1 || true)
expect "a malformed run id" refused "$(printf '%s' "$bad" | grep -q 'check constraint' && echo refused || echo "$bad")"
q "delete from seed_run_items; delete from seed_runs" >/dev/null

say "elo_percentile counts genuine profiles only"
expect "unchanged with no samples" "$PCT_BEFORE" "$(q "select elo_percentile(1150)")"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<SAMPLES
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666'), ('77777777-7777-7777-7777-777777777777');
insert into profiles (id, handle, display_name, school, elo, streak, is_sample) values
  ('66666666-6666-6666-6666-666666666666', 'sample-a', 'Sample A', 'stoicism', 900, 0, true),
  ('77777777-7777-7777-7777-777777777777', 'sample-b', 'Sample B', 'stoicism', 950, 0, true);
insert into debates (id,user_id,topic_slug,school,argument,argument_public,score,kind,is_sample,verdict_is_template)
  values ('sdeb','66666666-6666-6666-6666-666666666666','st','stoicism','sample words',true,60,'original',true,true);
SAMPLES
expect "two low sample ratings do not move a genuine percentile" "$PCT_BEFORE" "$(q "select elo_percentile(1150)")"
expect "debates_public carries the marker" "t t" "$(q "select is_sample || ' ' || verdict_is_template from debates_public where id = 'sdeb'" | sed 's/true/t/g')"
expect "genuine rows read false" "f f" "$(q "select is_sample || ' ' || verdict_is_template from debates_public where id = 'gpub'" | sed 's/false/f/g')"

say "no genuine row can be made to point at a sample row through the Data API"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<REF
insert into auth.users (id) values ('88888888-8888-8888-8888-888888888888');
insert into profiles (id, display_name, school, elo, streak) values ('88888888-8888-8888-8888-888888888888', 'Reader Two', 'stoicism', 1200, 0);
insert into quiz_results (id, school, vector, answers, anon_id) values ('GENRES001', 'stoicism', '{}', '[]', gen_random_uuid());
insert into quiz_results (id, school, vector, answers, anon_id, user_id) values ('GENRESR', 'stoicism', '{}', '[]', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888');
insert into challenges (id, challenger_result_id) values ('gchal', 'GENRESR');
insert into classes (id, code, owner_id, name) values ('sclass', 'samplecd', '66666666-6666-6666-6666-666666666666', 'Sample class');
insert into classes (id, code, owner_id, name) values ('gclass', 'genuinec', '$U', 'Genuine class');
insert into quiz_results (id, school, vector, answers, anon_id, is_sample) values ('sres', 'stoicism', '{}', '[]', gen_random_uuid(), true);
insert into challenges (id, challenger_result_id, is_sample) values ('schal', 'sres', true);
insert into exchanges (id, topic_slug, debate_a, debate_b, user_a, user_b, school_a, school_b, is_sample)
  values ('sex', 'st', 'sdeb', 'sdeb', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'stoicism', 'utilitarianism', true);
insert into turns (id, exchange_id, author_id, seq, quoted_claim, body, screen_result)
  values ('sturn', 'sex', '66666666-6666-6666-6666-666666666666', 1, 'sample words', repeat('a sample turn body. ', 10), 'ok');
REF
R=88888888-8888-8888-8888-888888888888
refused() { printf '%s' "$1" | grep -q 'cannot be referenced' && echo refused || echo "$1"; }
expect "authenticated joins a sample class" refused "$(refused "$(as_role authenticated "insert into class_members (class_id, user_id) values ('sclass', '$R')" $R)")"
expect "authenticated joins a genuine class" allowed "$(as_role authenticated "insert into class_members (class_id, user_id) values ('gclass', '$R')" $R)"
expect "anon challenges from a sample result" refused "$(refused "$(as_role anon "insert into challenges (id, challenger_result_id) values ('c1', 'sres')")")"
expect "anon names a sample challengee result" refused "$(refused "$(as_role anon "insert into challenges (id, challenger_result_id, challengee_result_id) values ('c2', 'GENRES001', 'sres')")")"
expect "anon names a sample challenger debate" refused "$(refused "$(as_role anon "insert into challenges (id, challenger_result_id, challenger_debate_id) values ('c3', 'GENRES001', 'sdeb')")")"
# The update policy on challenges is using (true), and a select policy only
# narrows an update that reads a column, so an update with no filter
# reaches every row; a party, who can read its own challenge, can also
# filter to it. Both are refused once they would name a sample row.
expect "anon updates every challenge to name a sample result" refused "$(refused "$(as_role anon "update challenges set challengee_result_id = 'sres'")")"
# A party sees its challenge through its own result, which it reads with
# the x-anon-id header the site sends.
PARTY="select set_config('request.headers', '{\"x-anon-id\": \"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\"}', true)"
expect "a party reaches its own challenge" "gchal" "$(psql -X -At -d "$DB" -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub', '$R', true); $PARTY; update challenges set status = 'open' where id = 'gchal' returning id; rollback;" 2>&1 | grep -x gchal)"
expect "a party updates its challenge to name a sample result" refused "$(refused "$(as_role authenticated "$PARTY; update challenges set challengee_result_id = 'sres' where id = 'gchal'" $R)")"
expect "a party updates its challenge to name a sample debate" refused "$(refused "$(as_role authenticated "$PARTY; update challenges set challengee_debate_id = 'sdeb' where id = 'gchal'" $R)")"
# createChallenge (src/app/actions.ts) inserts any result id with the
# server role, so a genuine challenge is checked whoever writes it.
expect "the server role cannot make a genuine challenge name a sample result" refused "$(refused "$(as_role service_role "insert into challenges (id, challenger_result_id) values ('c4', 'sres')")")"
expect "the server role can write a sample challenge (the seed)" allowed "$(as_role service_role "insert into challenges (id, challenger_result_id, is_sample) values ('c5', 'sres', true)")"
expect "the server role's genuine challenge" allowed "$(as_role service_role "insert into challenges (id, challenger_result_id) values ('c6', 'GENRES001')")"
expect "anon result naming a sample challenger" refused "$(refused "$(as_role anon "insert into quiz_results (id, school, vector, answers, anon_id, challenge_from) values ('q1', 'stoicism', '{}', '[]', gen_random_uuid(), 'sres')")")"
expect "anon result claiming a sample user" refused "$(refused "$(as_role anon "insert into quiz_results (id, school, vector, answers, anon_id, user_id) values ('q2', 'stoicism', '{}', '[]', gen_random_uuid(), '66666666-6666-6666-6666-666666666666')")")"
expect "anon genuine result" allowed "$(as_role anon "insert into quiz_results (id, school, vector, answers, anon_id) values ('q3', 'stoicism', '{}', '[]', gen_random_uuid())")"
expect "authenticated revision of a sample debate" refused "$(refused "$(as_role authenticated "insert into debates (id, user_id, topic_slug, school, argument, kind, parent_debate_id) values ('d1', '$R', 'st', 'stoicism', 'x', 'revision', 'sdeb')" $R)")"
expect "authenticated argues a sample challenge" refused "$(refused "$(as_role authenticated "insert into debates (id, user_id, topic_slug, school, argument, kind, challenge_id) values ('d2', '$R', 'st', 'stoicism', 'x', 'original', 'schal')" $R)")"
expect "authenticated blocks a sample account" refused "$(refused "$(as_role authenticated "insert into blocks (blocker_id, blocked_id) values ('$R', '66666666-6666-6666-6666-666666666666')" $R)")"
expect "authenticated reports a sample turn" refused "$(refused "$(as_role authenticated "insert into reports (id, turn_id, reporter_id, reason) values ('r1', 'sturn', '$R', 'spam')" $R)")"
expect "the server role may (the site's own writes)" allowed "$(as_role service_role "insert into class_members (class_id, user_id) values ('sclass', '77777777-7777-7777-7777-777777777777')")"
expect "a migration or the SQL editor may (no role set)" allowed "$(psql -X -At -d "$DB" -c "begin; insert into blocks (blocker_id, blocked_id) values ('$R', '66666666-6666-6666-6666-666666666666'); rollback;" >/dev/null 2>&1 && echo allowed || echo refused)"
expect "anon and authenticated cannot call the guard" "f f" "$(q "select has_function_privilege('anon', 'public.guard_sample_reference()', 'EXECUTE') || ' ' || has_function_privilege('authenticated', 'public.guard_sample_reference()', 'EXECUTE')" | sed 's/false/f/g')"
q "delete from turns where id = 'sturn'; delete from exchanges where id = 'sex'; delete from challenges where id in ('schal', 'gchal'); delete from quiz_results where id = 'GENRESR'; delete from quiz_results where id = 'sres'; delete from classes where id in ('sclass','gclass'); delete from quiz_results where id = 'GENRES001'; delete from profiles where id = '$R'; delete from auth.users where id = '$R'" >/dev/null

say "rollback refuses while a run is not torn down"
# The run alone: its one item is already deleted, so only the run's status
# can make the rollback refuse here.
q "insert into seed_runs (id, status, plan_hash, generator_version, seed, window_from, window_to) values ('run-cccccc','complete','h','g',1,now(),now())" >/dev/null
q "insert into seed_run_items (run_id, kind, logical_id, row_id, state) values ('run-cccccc','turn','t1','turn1','deleted')" >/dev/null
q "delete from debates where is_sample; delete from profiles where is_sample" >/dev/null
held=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/rollback/0021_sample_activity.down.sql" 2>&1 || true)
expect "refused for an open run" refused "$(printf '%s' "$held" | grep -q 'not torn down' && echo refused || echo "$held")"
q "update seed_runs set status = 'torn_down'; update seed_run_items set state = 'created'" >/dev/null
held=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/rollback/0021_sample_activity.down.sql" 2>&1 || true)
expect "refused for an item not deleted" refused "$(printf '%s' "$held" | grep -q 'not torn down' && echo refused || echo "$held")"
q "update seed_run_items set state = 'abandoned'" >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<SAMPLES2
insert into profiles (id, handle, display_name, school, elo, streak, is_sample) values
  ('66666666-6666-6666-6666-666666666666', 'sample-a', 'Sample A', 'stoicism', 900, 0, true);
SAMPLES2

say "rollback refuses while sample rows remain"
held=$(psql -X --single-transaction -v ON_ERROR_STOP=1 -q -d "$DB" -f "$REPO/supabase/rollback/0021_sample_activity.down.sql" 2>&1 || true)
expect "refused" refused "$(printf '%s' "$held" | grep -q 'sample rows remain' && echo refused || echo "$held")"
expect "nothing dropped" t "$(q "select exists (select 1 from information_schema.columns where table_name='profiles' and column_name='is_sample')")"
q "delete from debates where is_sample; delete from profiles where is_sample; delete from quiz_results where is_sample" >/dev/null

say "rollback"
apply "$REPO/supabase/rollback/0021_sample_activity.down.sql"
expect "debates_public columns as before" "$DP_COLS" "$(cols debates_public)"
expect "public_results columns as before" "$PR_COLS" "$(cols public_results)"
expect "debates_public definition as before, as text" t "$([ "$(viewdef debates_public)" = "$DP_DEF" ] && echo t || echo f)"
expect "public_results definition as before, as text" t "$([ "$(viewdef public_results)" = "$PR_DEF" ] && echo t || echo f)"
expect "debates_public owner and grants as before" "$DP_META" "$(meta debates_public)"
expect "public_results owner and grants as before" "$PR_META" "$(meta public_results)"
expect "debates_public rows as before" "$DP_DIGEST" "$(dp_digest)"
expect "public_results rows as before" "$PR_DIGEST" "$(pr_digest)"
expect "elo_percentile as before" "$PCT_BEFORE" "$(q "select elo_percentile(1150)")"
expect "no is_sample column left" 0 "$(q "select count(*) from information_schema.columns where table_schema='public' and column_name in ('is_sample','verdict_is_template')")"
expect "no registry left" 0 "$(q "select count(*) from pg_class where relname in ('seed_runs','seed_run_items')")"
expect "no guard left" 0 "$(q "select count(*) from pg_proc where proname in ('guard_sample_marker', 'guard_sample_reference')")"
expect "no guard trigger left" 0 "$(q "select count(*) from pg_trigger where tgname like '%guard_sample' or tgname like '%guard_reference'")"
expect "no created_at index left" 0 "$(q "select count(*) from pg_indexes where indexname='debates_created_at_idx'")"

say "re-apply 0021"
apply "$REPO/supabase/migrations/0021_sample_activity.sql"
after "re-applied"

if [ "$FAILED" -ne 0 ]; then say "FAILED"; exit 1; fi
say "all checks passed"
