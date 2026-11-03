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

drop view public.debates_public;

create view public.debates_public as
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

revoke all on public.debates_public from public, anon, authenticated;
grant select on public.debates_public to anon, authenticated;
grant all on public.debates_public to service_role;
