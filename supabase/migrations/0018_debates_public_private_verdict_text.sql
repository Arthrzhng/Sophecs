-- debates_public withholds every verdict field that can quote the argument
-- when the argument is private.
--
-- Arthur's ruling of 2026-11-03. The view has always nulled `argument`
-- unless `argument_public`, but it returned the whole verdict, and the
-- judge quotes the argument: across five golden runs, 269 judged samples,
-- every free-text field shares a run of four or more words with the
-- argument in some samples, `verdict_line` included ("hiding behind 'the
-- service should say which it has.'"). So a private argument could be read
-- in pieces from its own verdict, on the verdict page and through the API.
-- docs/decisions.md has the measurement, and
-- scripts/measure-verdict-quoting.mjs repeats it.
--
-- For a row whose argument is not public, these become JSON null, each
-- only where the verdict has it, so no key is added to a verdict that
-- never had one:
--
--   strongest_move, weakest_move, a_stronger_version_would, verdict_line,
--   improvement_note, rejection_reason,
--   unanswered_objection.claim, unanswered_objection.why_it_stands
--
-- Kept: rejected, score, fidelity, rigor, engagement, objection_answered,
-- prompt_version and unanswered_objection.school. A public argument's
-- verdict, and a null verdict, are returned unchanged. The author still
-- reads the full verdict from `debates` through row level security, which
-- this does not touch.
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
    id,
    topic_slug,
    school,
    score,
    case
      when d.argument_public or d.verdict is null or jsonb_typeof(d.verdict) <> 'object'
        then d.verdict
      else (
        select case
          when jsonb_typeof(r.v -> 'unanswered_objection') = 'object'
            then jsonb_set(
              r.v,
              '{unanswered_objection}',
              (r.v -> 'unanswered_objection')
                || '{"claim": null, "why_it_stands": null}'::jsonb
            )
          else r.v
        end
        from (
          select d.verdict || coalesce(
            (
              select jsonb_object_agg(k, 'null'::jsonb)
              from unnest(array[
                'strongest_move',
                'weakest_move',
                'a_stronger_version_would',
                'verdict_line',
                'improvement_note',
                'rejection_reason'
              ]) as k
              where d.verdict ? k
            ),
            '{}'::jsonb
          ) as v
        ) r
      )
    end as verdict,
    elo_before,
    elo_after,
    created_at,
    kind,
    parent_debate_id,
    case when argument_public then argument else null end as argument
  from debates d;
