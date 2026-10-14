-- Aura Health AI — Phase 1 schema
-- User-owned health data is private via Row Level Security.
-- health_measurements is RAW.
-- analysis_results, model_predictions, and health_insights are DERIVED.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  date_of_birth date,
  biological_sex text,
  height_cm numeric,
  weight_kg numeric,
  timezone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.health_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_at timestamptz not null,
  source text not null default 'manual',
  heart_rate_bpm numeric,
  spo2_pct numeric,
  systolic_mmhg numeric,
  diastolic_mmhg numeric,
  temperature_c numeric,
  steps integer,
  sleep_minutes integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.activity_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  activity_type text not null,
  duration_minutes integer,
  intensity text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  name text not null,
  severity integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.personal_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null,
  window_start timestamptz,
  window_end timestamptz,
  baseline_value numeric,
  unit text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.health_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generated_at timestamptz not null default timezone('utc', now()),
  title text not null,
  body text not null,
  status text not null default 'placeholder',
  source text not null default 'unconnected',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.connected_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  device_type text,
  status text not null default 'disconnected',
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analyzed_at timestamptz not null default timezone('utc', now()),
  analysis_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  predicted_at timestamptz not null default timezone('utc', now()),
  model_version_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (name, version)
);

alter table public.model_predictions
  add constraint model_predictions_model_version_id_fkey
  foreign key (model_version_id) references public.model_versions (id) on delete set null;

create index health_measurements_user_recorded_idx
  on public.health_measurements (user_id, recorded_at desc);
create index activity_context_user_occurred_idx
  on public.activity_context (user_id, occurred_at desc);
create index symptoms_user_occurred_idx
  on public.symptoms (user_id, occurred_at desc);
create index personal_baselines_user_metric_idx
  on public.personal_baselines (user_id, metric);
create index health_events_user_occurred_idx
  on public.health_events (user_id, occurred_at desc);
create index health_insights_user_generated_idx
  on public.health_insights (user_id, generated_at desc);
create index analysis_results_user_analyzed_idx
  on public.analysis_results (user_id, analyzed_at desc);
create index model_predictions_user_predicted_idx
  on public.model_predictions (user_id, predicted_at desc);
create index emergency_contacts_user_idx
  on public.emergency_contacts (user_id);
create index connected_devices_user_idx
  on public.connected_devices (user_id);

create trigger health_profiles_set_updated_at
  before update on public.health_profiles
  for each row execute procedure public.set_updated_at();

create trigger personal_baselines_set_updated_at
  before update on public.personal_baselines
  for each row execute procedure public.set_updated_at();

create trigger emergency_contacts_set_updated_at
  before update on public.emergency_contacts
  for each row execute procedure public.set_updated_at();

alter table public.health_profiles enable row level security;
alter table public.health_measurements enable row level security;
alter table public.activity_context enable row level security;
alter table public.symptoms enable row level security;
alter table public.personal_baselines enable row level security;
alter table public.health_events enable row level security;
alter table public.health_insights enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.connected_devices enable row level security;
alter table public.analysis_results enable row level security;
alter table public.model_predictions enable row level security;
alter table public.model_versions enable row level security;

create policy "owners manage health_profiles"
  on public.health_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage health_measurements"
  on public.health_measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage activity_context"
  on public.activity_context for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage symptoms"
  on public.symptoms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage personal_baselines"
  on public.personal_baselines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage health_events"
  on public.health_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage health_insights"
  on public.health_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage emergency_contacts"
  on public.emergency_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage connected_devices"
  on public.connected_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage analysis_results"
  on public.analysis_results for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage model_predictions"
  on public.model_predictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "authenticated read model_versions"
  on public.model_versions for select
  to authenticated
  using (true);
