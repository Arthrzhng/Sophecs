-- Rolls back 0021. Run only after every seed run is torn down
-- (scripts/unseed-production.ts): dropping the columns removes the marker,
-- and a sample row left behind would then look genuine. The rollback
-- refuses while any row is still marked.
--
-- Deploy the code that does not read these columns first.

do $$ begin
  if exists (select 1 from public.profiles where is_sample)
     or exists (select 1 from public.debates where is_sample)
     or exists (select 1 from public.quiz_results where is_sample)
     or exists (select 1 from public.challenges where is_sample)
     or exists (select 1 from public.exchanges where is_sample) then
    raise exception 'sample rows remain; tear the runs down first';
  end if;
end $$;

create or replace function public.elo_percentile(user_elo numeric)
returns numeric
language sql
stable
as $$
  select case when (select count(*) from profiles) = 0 then 0
    else (select count(*) from profiles where elo < user_elo)::numeric
         / (select count(*) from profiles)::numeric
  end;
$$;

-- The views lose columns, which create or replace cannot do: drop,
-- recreate as before, and set the grants 0016 left (a recreated view
-- picks up the default privileges, which grant anon and authenticated
-- everything).
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
    case when d.argument_public then d.argument else null end as argument,
    d.motion_text
  from debates d
  left join debates p on p.id = d.parent_debate_id;
revoke all on public.debates_public from public, anon, authenticated;
grant select on public.debates_public to anon, authenticated;
grant all on public.debates_public to service_role;

drop view public.public_results;
create view public.public_results as
  select id, school, secondary, vector, challenge_from, created_at from quiz_results;
revoke all on public.public_results from public, anon, authenticated;
grant select on public.public_results to anon, authenticated;
grant all on public.public_results to service_role;

drop index public.debates_created_at_idx;

drop trigger profiles_guard_sample on public.profiles;
drop trigger quiz_results_guard_sample on public.quiz_results;
drop trigger debates_guard_sample on public.debates;
drop trigger challenges_guard_sample on public.challenges;
drop trigger exchanges_guard_sample on public.exchanges;
drop function public.guard_sample_marker();

drop table public.seed_run_items;
drop table public.seed_runs;

alter table public.debates drop column verdict_is_template;
alter table public.exchanges drop column is_sample;
alter table public.challenges drop column is_sample;
alter table public.debates drop column is_sample;
alter table public.quiz_results drop column is_sample;
alter table public.profiles drop column is_sample;
