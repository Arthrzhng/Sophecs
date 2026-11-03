-- debates_public withholds every verdict field that can quote the argument
-- when the argument is private.
--
-- Arthur's ruling of 2026-11-03. The view has always nulled `argument`
-- unless `argument_public`, but it returned the whole verdict, and the
-- judge quotes the argument: across five golden runs, 269 judged samples,
-- each of the six free-text fields measured shares a run of four or more
-- words with the argument in some samples, `verdict_line` included ("hiding behind 'the
-- service should say which it has.'"). So a private argument could be read
-- in pieces from its own verdict, on the verdict page and through the API.
-- docs/decisions.md has the measurement, and
-- scripts/measure-verdict-quoting.mjs repeats it.
--
-- For a row whose argument is not public, or a revision whose original is
-- not public (the revision judge is shown the original and may quote it),
-- the verdict is rebuilt from a fixed list of fields that cannot carry the
-- argument's words, and everything else is left out:
--
--   rejected, score, fidelity, rigor, engagement, objection_answered,
--   prompt_version, and unanswered_objection reduced to its school
--   (with claim and why_it_stands as JSON null, the shape the page reads)
--
-- Left out, not set to JSON null: reading a withheld field gives null
-- either way, and a list of what to keep means a field the verdict gains
-- later is withheld until someone decides it is safe, rather than shown
-- until someone notices. Each kept field must also have its own type (a
-- boolean, a number or null, a version such as "v2", a school id), so text
-- cannot ride through in a field that is meant to hold a number.
-- src/lib/verdict-privacy.ts applies the same list and the same types on
-- the page, and tests/verdict-privacy.test.ts holds the two lists equal. A
-- public argument's verdict and a null verdict are returned unchanged; a
-- private one that is not a JSON object becomes null. The author still
-- reads the full verdict from `debates` through row level security, which
-- this does not touch. The view's own `argument` column still follows only
-- the row's own argument_public.
--
-- CREATE OR REPLACE VIEW keeps the view's owner and grants, so 0016 and
-- 0017 stand, and keeps every column's name, type and position, which it
-- requires.
--
-- Locks: ACCESS EXCLUSIVE on the view only, for a catalogue update; no
-- lock on `debates`. No transaction of its own: the Supabase runner wraps
-- the file, and by hand it is `psql --single-transaction`.

create or replace view public.debates_public as
  select
    d.id,
    d.topic_slug,
    d.school,
    d.score,
    case
      when d.verdict is null then d.verdict
      when d.argument_public and coalesce(p.argument_public, true) then d.verdict
      when jsonb_typeof(d.verdict) <> 'object' then null
      else (
        select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        from jsonb_each(d.verdict) e
        where e.key in (
          'rejected',
          'score',
          'fidelity',
          'rigor',
          'engagement',
          'objection_answered',
          'prompt_version'
        )
        and case
          when e.key = 'rejected' or e.key = 'objection_answered'
            then jsonb_typeof(e.value) = 'boolean'
          when e.key = 'prompt_version'
            then jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^v[0-9]+$'
          else jsonb_typeof(e.value) in ('number', 'null')
        end
      ) || case
        when jsonb_typeof(d.verdict -> 'unanswered_objection' -> 'school') = 'string'
          and (d.verdict -> 'unanswered_objection' ->> 'school') ~ '^[a-z-]+$'
          then jsonb_build_object(
            'unanswered_objection',
            jsonb_build_object(
              'school', d.verdict -> 'unanswered_objection' -> 'school',
              'claim', null,
              'why_it_stands', null
            )
          )
        else '{}'::jsonb
      end
    end as verdict,
    d.elo_before,
    d.elo_after,
    d.created_at,
    d.kind,
    d.parent_debate_id,
    case when d.argument_public then d.argument else null end as argument
  from debates d
  left join debates p on p.id = d.parent_debate_id;
