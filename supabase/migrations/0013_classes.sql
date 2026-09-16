-- Task 9: the teacher class link.
--
-- Numbered 0013, not the brief's 0011: 0008 ai_calls.prompt_version,
-- 0009 revisions, 0010 reading_responses, 0011 account_deletion_fks,
-- 0012 counterpart.
--
-- There is no teacher role. Owning a class is the only distinction, and it
-- is a row, not a flag on a user — which means a teacher account and a
-- student account are the same kind of thing and nothing has to be granted.

create table if not exists classes (
  id text primary key,
  code text unique not null,
  owner_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz default now()
);
create index if not exists classes_owner_idx on classes (owner_id);

create table if not exists class_members (
  class_id text references classes (id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on class_members (user_id);

alter table classes enable row level security;
alter table class_members enable row level security;

-- The policies as drafted in the brief recurse: `classes` select reads
-- `class_members`, whose own select policy reads `classes`, and Postgres
-- refuses with "infinite recursion detected in policy for relation
-- classes". Confirmed against the real database before fixing.
--
-- Two SECURITY DEFINER helpers break the cycle. RLS is not applied inside
-- a definer function, so each policy can ask its question about the other
-- table without re-entering that table's policy. Both are `stable` (one
-- evaluation per query, not per row) and pin `search_path` so the function
-- body cannot be redirected by a caller's schema.
create or replace function is_class_member(p_class_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from class_members m
    where m.class_id = p_class_id and m.user_id = p_user_id
  );
$$;

create or replace function is_class_owner(p_class_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from classes c
    where c.id = p_class_id and c.owner_id = p_user_id
  );
$$;

drop policy if exists "class read owner or member" on classes;
create policy "class read owner or member" on classes
  for select using (auth.uid() = owner_id or is_class_member(id, auth.uid()));

drop policy if exists "class insert own" on classes;
create policy "class insert own" on classes
  for insert with check (auth.uid() = owner_id);

drop policy if exists "member read own or owner" on class_members;
create policy "member read own or owner" on class_members
  for select using (auth.uid() = user_id or is_class_owner(class_id, auth.uid()));

drop policy if exists "member join self" on class_members;
create policy "member join self" on class_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "member leave self" on class_members;
create policy "member leave self" on class_members
  for delete using (auth.uid() = user_id);
