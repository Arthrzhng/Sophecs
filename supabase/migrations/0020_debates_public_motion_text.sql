-- debates_public carries motion_text, so the verdict page and its OG image
-- read the motion's stored wording from the view instead of from debates.
--
-- Stage 2 of the brief of 2026-11-03, and the order docs/decisions.md set
-- out ("Phase 3 item: move `motion_text` into `debates_public`"): this
-- migration is applied and confirmed on its own, and only then does the
-- code that selects the column deploy. Until then both pages read
-- debates.motion_text with the admin client.
--
-- The view is 0018's, verdict expression and all, with motion_text
-- appended as the last column. CREATE OR REPLACE VIEW may only add columns
-- at the end, and keeps the owner and the grants 0016 and 0017 set.
--
-- A deliberate widening: anon and authenticated hold SELECT on this view,
-- so the column becomes readable through the Data API. It is the motion as
-- it was worded when the argument was written, which is public content and
-- is printed on the public verdict page; nothing about the argument or its
-- author.
--
-- Locks: ACCESS EXCLUSIVE on the view only, for a catalogue update; no
-- lock on debates. No transaction of its own: the Supabase runner wraps
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
    case when argument_public then argument else null end as argument,
    motion_text
  from debates d;
