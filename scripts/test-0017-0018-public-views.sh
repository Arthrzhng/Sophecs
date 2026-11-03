#!/usr/bin/env bash
# Proves migrations 0017 and 0018 on a throwaway local database, under
# production's grants as 0016 left them:
#
# - 0017: anon and authenticated can no longer read profiles_public;
#   service_role still can.
# - 0018: debates_public returns JSON null for every verdict field that can
#   quote the argument when the argument is private, keeps the scores,
#   leaves a public argument's verdict and a null verdict untouched, adds no
#   key a verdict did not have, and keeps 0016's grants.
#
# Then both roll back, the view returns the whole verdict again, and both
# re-apply.
#
# Usage: scripts/test-0017-0018-public-views.sh [port]
set -euo pipefail

PORT="${1:-55432}"
DB="sophecs_0017_test_$$"
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

say "shim, migrations 0001 to 0016, production's grants"
apply "$REPO/scripts/local-auth-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql; do
  # 0001 to 0016 only: 0017 and 0018 are under test.
  [ "$((10#$(basename "$f" | cut -c1-4)))" -le 16 ] || continue
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
 ('none','44444444-4444-4444-4444-444444444444','vt','stoicism','unjudged secret',false,null,'original',null),
 ('xtra','44444444-4444-4444-4444-444444444444','vt','stoicism','extra secret',false,70,'original',
  '{"rejected":false,"score":70,"fidelity":7,"rigor":7,"engagement":6,"notes":"a secret note",
    "unanswered_objection":{"school":"utilitarianism","claim":"c secret","why_it_stands":"y","extra":"objection secret"},
    "prompt_version":"v2"}'),
 ('ostr','44444444-4444-4444-4444-444444444444','vt','stoicism','string secret',false,70,'original',
  '{"rejected":false,"score":70,"unanswered_objection":"an objection quoting secret words","prompt_version":"v2"}'),
 ('arr','44444444-4444-4444-4444-444444444444','vt','stoicism','array secret',false,70,'original',
  '["a verdict that is not an object, quoting secret words"]');
ROWS

pv() { q "select verdict$1 from debates_public where id = '$2'"; }

say "before 0017 and 0018"
expect "anon reads profiles_public" allowed "$(as_role anon "select display_name from public.profiles_public")"
expect "private strongest_move readable through the view" "quotes secret words" "$(pv "->>'strongest_move'" priv)"

say "apply 0017 and 0018"
apply "$REPO/supabase/migrations/0017_profiles_public_no_select.sql"
apply "$REPO/supabase/migrations/0018_debates_public_private_verdict_text.sql"

check_after() {
  for role in anon authenticated; do
    expect "$role SELECT profiles_public" f "$(q "select has_table_privilege('$role', 'public.profiles_public', 'SELECT')")"
    expect "$role reads profiles_public" denied "$(as_role "$role" "select display_name from public.profiles_public")"
    for v in debates_public exchanges_public public_results; do
      expect "$role SELECT $v kept" t "$(q "select has_table_privilege('$role', 'public.$v', 'SELECT')")"
    done
    for p in INSERT UPDATE DELETE; do
      expect "$role $p debates_public still revoked" f "$(q "select has_table_privilege('$role', 'public.debates_public', '$p')")"
    done
  done
  expect "service_role SELECT profiles_public kept" t "$(q "select has_table_privilege('service_role', 'public.profiles_public', 'SELECT')")"

  # The private row: rebuilt from the keep-list, so every quoting field is
  # gone, not nulled.
  for k in strongest_move weakest_move a_stronger_version_would verdict_line; do
    expect "priv $k gone" f "$(q "select verdict ? '$k' from debates_public where id = 'priv'")"
  done
  expect "priv keys" "engagement,fidelity,prompt_version,rejected,rigor,score,unanswered_objection" \
    "$(q "select string_agg(k, ',' order by k) from debates_public, jsonb_object_keys(verdict) k where id = 'priv'")"
  expect "priv objection claim" "null" "$(pv "->'unanswered_objection'->'claim'" priv)"
  expect "priv objection why_it_stands" "null" "$(pv "->'unanswered_objection'->'why_it_stands'" priv)"
  expect "priv objection school kept" "utilitarianism" "$(pv "->'unanswered_objection'->>'school'" priv)"
  expect "priv scores kept" "72 7 7 6" "$(pv "->>'score' || ' ' || (verdict->>'fidelity') || ' ' || (verdict->>'rigor') || ' ' || (verdict->>'engagement')" priv)"
  expect "priv prompt_version kept" "v2" "$(pv "->>'prompt_version'" priv)"
  expect "priv: no secret anywhere in the public verdict" 0 "$(q "select count(*) from debates_public where id = 'priv' and verdict::text like '%secret%'")"
  expect "priv argument hidden" "" "$(q "select argument from debates_public where id = 'priv'")"

  # Public, rejected, revision, v1 and unjudged rows.
  expect "pub verdict unchanged" t "$(q "select v.verdict = d.verdict from debates_public v join debates d using (id) where id = 'pub'")"
  expect "rej rejection_reason gone" f "$(q "select verdict ? 'rejection_reason' from debates_public where id = 'rej'")"
  expect "rej rejected kept" "true" "$(pv "->>'rejected'" rej)"
  expect "rej keys" "prompt_version,rejected" "$(q "select string_agg(k, ',' order by k) from debates_public, jsonb_object_keys(verdict) k where id = 'rej'")"
  expect "rev improvement_note gone" f "$(q "select verdict ? 'improvement_note' from debates_public where id = 'rev'")"
  expect "rev objection_answered kept" "true" "$(pv "->>'objection_answered'" rev)"
  expect "v1 has no unanswered_objection added" f "$(q "select verdict ? 'unanswered_objection' from debates_public where id = 'v1'")"
  expect "v1 strongest_move gone" f "$(q "select verdict ? 'strongest_move' from debates_public where id = 'v1'")"
  expect "v1 keys" "engagement,fidelity,prompt_version,rejected,rigor,score" "$(q "select string_agg(k, ',' order by k) from debates_public, jsonb_object_keys(verdict) k where id = 'v1'")"
  expect "xtra: an unknown top-level key is withheld" f "$(q "select verdict ? 'notes' from debates_public where id = 'xtra'")"
  expect "xtra: the objection keeps its school only" '{"claim": null, "school": "utilitarianism", "why_it_stands": null}' "$(pv "->'unanswered_objection'" xtra)"
  expect "ostr: an objection that is not an object is withheld" f "$(q "select verdict ? 'unanswered_objection' from debates_public where id = 'ostr'")"
  expect "arr: a private verdict that is not an object is null" t "$(q "select verdict is null from debates_public where id = 'arr'")"
  expect "unjudged verdict stays null" t "$(q "select verdict is null from debates_public where id = 'none'")"
  expect "no secret in any public verdict" 0 "$(q "select count(*) from debates_public where verdict::text like '%secret%'")"
  expect "debates itself untouched" "quotes secret words" "$(q "select verdict->>'strongest_move' from debates where id = 'priv'")"
  expect "anon reads debates_public" allowed "$(as_role anon "select verdict from public.debates_public")"
  expect "view columns unchanged" "id,topic_slug,school,score,verdict,elo_before,elo_after,created_at,kind,parent_debate_id,argument" \
    "$(q "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'debates_public'")"
}

say "after 0017 and 0018"
check_after

say "rollback 0018 then 0017"
apply "$REPO/supabase/rollback/0018_debates_public_private_verdict_text.down.sql"
apply "$REPO/supabase/rollback/0017_profiles_public_no_select.down.sql"
expect "private strongest_move readable again" "quotes secret words" "$(pv "->>'strongest_move'" priv)"
expect "anon reads profiles_public again" allowed "$(as_role anon "select display_name from public.profiles_public")"
expect "0016 still holds after the rollbacks" f "$(q "select has_table_privilege('anon', 'public.debates_public', 'UPDATE')")"

say "re-apply both"
apply "$REPO/supabase/migrations/0017_profiles_public_no_select.sql"
apply "$REPO/supabase/migrations/0018_debates_public_private_verdict_text.sql"
check_after

if [ "$FAILED" -ne 0 ]; then say "FAILED"; exit 1; fi
say "all checks passed"
