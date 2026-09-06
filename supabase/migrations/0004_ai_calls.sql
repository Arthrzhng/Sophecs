-- Phase 2b: cost/latency ledger for every Anthropic call. No RLS policies —
-- admin client only, per the brief ("ai_calls: no policies. Admin client
-- only."). RLS is still enabled so a future policy-less client can't read
-- it by accident; enabling RLS with zero policies denies all access to
-- anon/authenticated by default.

create table ai_calls (
  id text primary key,
  user_id uuid references auth.users,
  kind text not null check (kind in ('judge', 'golden')),
  model text not null,
  cost_usd numeric not null,
  latency_ms int not null,
  debate_id text references debates (id),
  created_at timestamptz not null default now()
);
create index on ai_calls (user_id, created_at);
create index on ai_calls (kind, created_at);

alter table ai_calls enable row level security;
