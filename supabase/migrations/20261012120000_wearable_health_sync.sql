-- Preserve source record identifiers so repeated phone syncs are idempotent.
alter table public.health_measurements
  add column if not exists source_record_id text;
alter table public.health_measurements
  add column if not exists resting_heart_rate_bpm numeric;

create unique index if not exists health_measurements_source_record_unique
  on public.health_measurements (user_id, source, source_record_id);

-- One connection row per user's health platform.
create unique index if not exists connected_devices_user_name_unique
  on public.connected_devices (user_id, name);
