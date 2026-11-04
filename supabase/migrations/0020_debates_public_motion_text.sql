-- debates_public carries motion_text, so the verdict page and its OG image
-- read the motion's stored wording from the view instead of from debates.
--
-- Stage 2 of the brief of 2026-11-03, and the order docs/decisions.md set
-- out ("Phase 3 item: move `motion_text` into `debates_public`"): this
-- migration is applied and confirmed on its own, and only then does the
-- code that selects the column deploy. Until then both pages read
-- debates.motion_text with the admin client.
--
-- The view is 0018's, character for character (the keep-list for a
-- private argument's verdict, the parent join, the type checks), with
-- d.motion_text appended as the last column.
-- scripts/test-0020-motion-text-view.sh checks that every other column of
-- every row reads as it did under 0018, and tests/verdict-privacy.test.ts
-- that the two definitions differ by that column alone. CREATE OR REPLACE
-- VIEW may only add columns at the end, and keeps the owner and the grants
-- 0016 set.
--
-- A deliberate widening: anon and authenticated hold SELECT on this view,
-- so the column becomes readable through the Data API. It is the motion as
-- it was worded when the argument was written, which is public content and
-- is printed on the public verdict page; nothing about the argument or its
-- author. It is shown for private arguments too, as the page already shows
-- it.
--
-- Rolling back: 0015's rollback drops debates.motion_text, which Postgres
-- refuses while this view reads it (safely, inside its transaction). So
-- 0020's rollback goes first; scripts/test-migrations.sh runs them in
-- that order.
--
-- Locks, until commit: ACCESS EXCLUSIVE on the view, which holds every
-- read of debates_public for the moment the catalogue update takes, and
-- ACCESS SHARE on debates, which conflicts only with ACCESS EXCLUSIVE. No transaction of its own: the
-- Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`.

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
    case when d.argument_public then d.argument else null end as argument,
    d.motion_text
  from debates d
  left join debates p on p.id = d.parent_debate_id;
