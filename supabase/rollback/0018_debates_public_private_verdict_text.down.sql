-- Rolls back 0018 by returning debates_public to the definition 0009 gave
-- it, with the whole verdict for every row.
--
-- This makes the judge's quotations of a private argument readable again,
-- on the verdict page and through the API. Loss-free: a view, no rows.
-- CREATE OR REPLACE keeps the owner and the grants 0016 and 0017 set.

create or replace view public.debates_public as
  select
    id,
    topic_slug,
    school,
    score,
    verdict,
    elo_before,
    elo_after,
    created_at,
    kind,
    parent_debate_id,
    case when argument_public then argument else null end as argument
  from debates d;
