-- Rolls back 0020 by returning debates_public to 0018's definition, without
-- motion_text. Deploy the code that reads motion_text from debates first,
-- or the verdict page and its OG image ask the view for a column it no
-- longer has and 404.
--
-- A view, no rows: loss-free. CREATE OR REPLACE cannot drop a column, so
-- this drops and recreates the view, then sets the grants 0016 left. A new
-- view picks up Supabase's default privileges, which give anon and
-- authenticated every privilege on it: the write hole 0016 closed. So
-- everything is revoked from them first, and SELECT alone given back.
-- The definition below is 0018's, character for character, with "create
-- or replace" as "create"; scripts/test-0020-motion-text-view.sh checks
-- that pg_get_viewdef reads the same after this as it did under 0018.

drop view public.debates_public;

create view public.debates_public as
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

revoke all on public.debates_public from public, anon, authenticated;
grant select on public.debates_public to anon, authenticated;
grant all on public.debates_public to service_role;
