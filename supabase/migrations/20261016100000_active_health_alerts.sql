create table public.active_health_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  severity text not null check (severity in ('MONITOR', 'PRIORITY')),
  title text not null,
  message text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'ACKNOWLEDGED')),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index active_health_alerts_user_status_created_idx
  on public.active_health_alerts (user_id, status, created_at desc);

alter table public.active_health_alerts enable row level security;

create policy "Users can view their own active health alerts"
  on public.active_health_alerts for select
  using (auth.uid() = user_id);

create policy "Users can create their own active health alerts"
  on public.active_health_alerts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own active health alerts"
  on public.active_health_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
