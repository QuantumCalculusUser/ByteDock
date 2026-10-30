-- ByteDock Phase 2.5: account-isolated cloud workspaces and usage accounting.
-- Run this once in Supabase Dashboard -> SQL Editor using the project owner role.

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null default '{"files":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on table public.workspaces from anon, authenticated;
grant select, insert, update on table public.workspaces to authenticated;
grant all on table public.workspaces to service_role;

-- The browser currently accesses workspace data only through ByteDock's authenticated
-- backend. These policies are a second line of defense if direct user access is added.
drop policy if exists "Users can read their own ByteDock workspace" on public.workspaces;
drop policy if exists "Users can insert their own ByteDock workspace" on public.workspaces;
drop policy if exists "Users can update their own ByteDock workspace" on public.workspaces;
create policy "Users can read their own ByteDock workspace"
  on public.workspaces for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert their own ByteDock workspace"
  on public.workspaces for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own ByteDock workspace"
  on public.workspaces for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ai_tokens', 'execution_runs', 'execution_cpu_ms')),
  units bigint not null check (units > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_month_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;
revoke all on table public.usage_events from anon, authenticated;
grant select on table public.usage_events to authenticated;
grant all on table public.usage_events to service_role;

drop policy if exists "Users can read their own ByteDock usage" on public.usage_events;
create policy "Users can read their own ByteDock usage"
  on public.usage_events for select to authenticated using (auth.uid() = user_id);

-- Do not expose service-role credentials to the browser. ByteDock's Node backend
-- uses the server-only service_role key and verifies the Supabase access token first.

-- The usage_events identity column is backed by a sequence. The backend's
-- service-only inserts need permission to invoke that sequence.
grant usage, select on all sequences in schema public to service_role;
