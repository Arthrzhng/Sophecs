#!/usr/bin/env bash
# Proves migration 0020 on a throwaway local database, under production's
# grants as 0016 and 0017 left them:
#
# - debates_public gains motion_text as its last column, each row's own,
#   readable by anon, and nothing else about the view changes: 0018's
#   verdict redaction holds (its keep-list, its parent rule), every other
#   column of every row reads exactly as before, a private argument stays
#   hidden, and anon and authenticated can still only SELECT;
# - the rollback returns the view to 0018's definition, read back as the
#   same text from pg_get_viewdef, with the same rows, and, under
#   Supabase's default privileges, without reopening the write hole 0016
#   closed;
# - 0020 applies again after it.
#
# Usage: scripts/test-0020-motion-text-view.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0020_test_$$"
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
  else echo allowed; fi
}

cleanup() { psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"

say "shim, every migration before 0020, production's grants"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  # Everything before 0020, which is under test.
  [ "$((10#$(basename "$f" | cut -c1-4)))" -lt 20 ] || continue
  case "$(basename "$f")" in 0016_*)
    # Recreate what Supabase's default privileges gave the views, so that
    # 0016 has something to revoke and the state matches production.
    for v in debates_public exchanges_public profiles_public public_results; do
      q "grant all on public.$v to anon, authenticated, service_role" >/dev/null
    done
    q "grant all on public.debates to service_role" >/dev/null ;;
  esac
  apply "$f"
done

say "rows: private, public, rejected, revision, v1, unjudged"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null <<'ROWS'
insert into auth.users (id) values ('44444444-4444-4444-4444-444444444444');
insert into profiles (id, handle, display_name, school, elo, streak)
  values ('44444444-4444-4444-4444-444444444444', 'probe', 'Probe Name', 'stoicism', 1000, 0);
insert into debate_topics (slug,title,motion,stances,micro_before,micro_after,sort,active)
  values ('vt','VT','A motion.','{}'::jsonb,'a','b',99,true);
insert into debates (id,user_id,topic_slug,school,argument,argument_public,score,kind,verdict) values
 ('priv','44444444-4444-4444-4444-444444444444','vt','stoicism','secret words',false,72,'original',
  '{"rejected":false,"score":72,"fidelity":7,"rigor":7,"engagement":6,
    "strongest_move":"quotes secret words","weakest_move":"quotes secret words",
    "a_stronger_version_would":"rewrite secret words","verdict_line":"secret words, scored",
    "unanswered_objection":{"school":"utilitarianism","claim":"secret words claim","why_it_stands":"secret words stand"},
    "prompt_version":"v2"}'),
 ('pub','44444444-4444-4444-4444-444444444444','vt','stoicism','open words',true,70,'original',
  '{"rejected":false,"score":70,"fidelity":7,"rigor":7,"engagement":6,
    "strongest_move":"quotes open words","weakest_move":"w","a_stronger_version_would":"a",
    "verdict_line":"open words, scored",
    "unanswered_objection":{"school":"utilitarianism","claim":"c","why_it_stands":"y"},
    "prompt_version":"v2"}'),
 ('rej','44444444-4444-4444-4444-444444444444','vt','stoicism','spam secret',false,null,'original',
  '{"rejected":true,"rejection_reason":"spam secret is not an argument","prompt_version":"v2"}'),
 ('rev','44444444-4444-4444-4444-444444444444','vt','stoicism','revised secret',false,75,'revision',
  '{"rejected":false,"score":75,"fidelity":8,"rigor":7,"engagement":7,
    "strongest_move":"s","weakest_move":"w","a_stronger_version_would":"a","verdict_line":"v",
    "unanswered_objection":{"school":"virtue-ethics","claim":"c","why_it_stands":"y"},
    "objection_answered":true,"improvement_note":"now says revised secret","prompt_version":"v2"}'),
 ('v1','44444444-4444-4444-4444-444444444444','vt','stoicism','old secret',false,68,'original',
  '{"rejected":false,"score":68,"fidelity":8,"rigor":6,"engagement":6,
    "strongest_move":"old secret","weakest_move":"w","a_stronger_version_would":"a",
    "verdict_line":"v","prompt_version":"v1"}'),
 ('none','44444444-4444-4444-4444-444444444444','vt','stoicism','unjudged secret',false,null,'original',null);
-- A published revision of a private original: the revision judge was shown
-- the original and may quote it, so 0018 withholds this verdict's text too.
insert into debates (id,user_id,topic_slug,school,argument,argument_public,score,kind,parent_debate_id,verdict) values
 ('pubrev','44444444-4444-4444-4444-444444444444','vt','stoicism','open revision',true,74,'revision','priv',
  '{"rejected":false,"score":74,"fidelity":8,"rigor":7,"engagement":7,
    "verdict_line":"answers secret words","objection_answered":true,
    "improvement_note":"no longer says secret words","prompt_version":"v2"}');
ROWS


q "update debates set motion_text = 'The stored wording of ' || id || '.'" >/dev/null
q "update debates set motion_text = null where id = 'none'" >/dev/null

# What Supabase does to every new table or view in public: anon and
# authenticated get every privilege on it. 0020's rollback recreates the
# view, so without this the test could not see whether it closes the hole
# 0016 closed.
q "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null

pv() { q "select verdict$1 from debates_public where id = '$2'"; }
cols() { q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'debates_public'"; }
OLD_COLS="id,topic_slug,school,score,verdict,elo_before,elo_after,created_at,kind,parent_debate_id,argument"

grants_hold() {
  for role in anon authenticated; do
    expect "$1: $role SELECT debates_public" t "$(q "select has_table_privilege('$role', 'public.debates_public', 'SELECT')")"
    for p in INSERT UPDATE DELETE TRUNCATE REFERENCES TRIGGER; do
      expect "$1: $role $p debates_public" f "$(q "select has_table_privilege('$role', 'public.debates_public', '$p')")"
    done
    expect "$1: $role reads debates_public" allowed "$(as_role "$role" "select verdict from public.debates_public")"
  done
  expect "$1: service_role SELECT debates_public" t "$(q "select has_table_privilege('service_role', 'public.debates_public', 'SELECT')")"
}

# Every column but motion_text, for every row, as one digest: "nothing
# else about the view changes" checked row by row rather than by sample.
rows_digest() { q "select md5(string_agg(row(id, topic_slug, school, score, verdict, elo_before, elo_after, created_at, kind, parent_debate_id, argument)::text, '|' order by id)) from debates_public"; }
viewdef() { q "select pg_get_viewdef('public.debates_public'::regclass, true)"; }
# Owner, options and the whole ACL, column grants included: has_table_privilege
# above asks about seven privileges; this compares everything. The ACL's
# entries are sorted, because a recreated view lists the same grants in
# the order they were made.
meta() { q "select pg_get_userbyid(c.relowner) || ' | ' || coalesce(c.reloptions::text, '-') || ' | ' || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x), '-') || ' | ' || (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attacl is not null) || ' column acl(s)' from pg_class c where c.oid = 'public.debates_public'::regclass"; }

redaction_holds() {
  # 0018 leaves a withheld field out rather than setting it to null.
  for k in strongest_move weakest_move a_stronger_version_would verdict_line; do
    expect "$1: priv $k left out" f "$(pv " ? '$k'" priv)"
  done
  expect "$1: priv objection keeps its school only" '{"claim": null, "school": "utilitarianism", "why_it_stands": null}' "$(pv "->'unanswered_objection'" priv)"
  expect "$1: published revision of a private original withheld" f "$(pv " ? 'verdict_line'" pubrev)"
  expect "$1: published revision keeps its score" 74 "$(pv "->>'score'" pubrev)"
  expect "$1: rejected private row keeps only rejected, prompt_version" '{"rejected": true, "prompt_version": "v2"}' "$(pv "" rej)"

  expect "$1: priv scores kept" "72 7 7 6" "$(pv "->>'score' || ' ' || (verdict->>'fidelity') || ' ' || (verdict->>'rigor') || ' ' || (verdict->>'engagement')" priv)"
  expect "$1: no secret in any public verdict" 0 "$(q "select count(*) from debates_public where verdict::text like '%secret%'")"
  expect "$1: priv argument hidden" "" "$(q "select argument from debates_public where id = 'priv'")"
  expect "$1: pub verdict unchanged" t "$(q "select v.verdict = d.verdict from debates_public v join debates d using (id) where id = 'pub'")"
  expect "$1: pub argument shown" "open words" "$(q "select argument from debates_public where id = 'pub'")"
}

say "before 0020: 0018's view"
expect "columns" "$OLD_COLS" "$(cols)"
DIGEST_0018="$(rows_digest)"
VIEWDEF_0018="$(viewdef)"
META_0018="$(meta)"
echo "  under 0018: $META_0018"
expect "0018's view has the parent join" t "$(q "select pg_get_viewdef('public.debates_public'::regclass, true) ilike '%left join debates p on%'")"
grants_hold "before"
redaction_holds "before"

say "apply 0020"
apply "$REPO/supabase/migrations/0020_debates_public_motion_text.sql"

after() {
  expect "$1: columns, motion_text last" "$OLD_COLS,motion_text" "$(cols)"
  expect "$1: motion_text is text" "text" "$(q "select data_type from information_schema.columns where table_schema = 'public' and table_name = 'debates_public' and column_name = 'motion_text'")"
  expect "$1: motion_text for every row is the debate's own" 0 "$(q "select count(*) from debates_public v join debates d using (id) where v.motion_text is distinct from d.motion_text")"
  expect "$1: a private row's motion is shown" "The stored wording of priv." "$(q "select motion_text from debates_public where id = 'priv'")"
  expect "$1: a null motion stays null" t "$(q "select motion_text is null from debates_public where id = 'none'")"
  expect "$1: anon reads motion_text" allowed "$(as_role anon "select motion_text from public.debates_public")"
  expect "$1: every other column of every row as under 0018" "$DIGEST_0018" "$(rows_digest)"
  expect "$1: owner, options and grants as under 0018" "$META_0018" "$(meta)"
  grants_hold "$1"
  redaction_holds "$1"
}
after "after 0020"

say "rollback 0020"
apply "$REPO/supabase/rollback/0020_debates_public_motion_text.down.sql"
expect "columns back to 0018's" "$OLD_COLS" "$(cols)"
expect "definition back to 0018's, as text" t "$([ "$(viewdef)" = "$VIEWDEF_0018" ] && echo t || echo f)"
expect "rows as under 0018" "$DIGEST_0018" "$(rows_digest)"
expect "owner, options and grants as under 0018" "$META_0018" "$(meta)"
grants_hold "after rollback"
redaction_holds "after rollback"

say "re-apply 0020"
apply "$REPO/supabase/migrations/0020_debates_public_motion_text.sql"
after "re-applied"

if [ "$FAILED" -ne 0 ]; then say "FAILED"; exit 1; fi
say "all checks passed"
