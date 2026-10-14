alter table public.model_predictions
  add column if not exists source_measurement_id uuid
  references public.health_measurements (id) on delete cascade;

create unique index if not exists model_predictions_user_measurement_model_uidx
  on public.model_predictions (user_id, source_measurement_id, model_version_id);

insert into public.model_versions (name, version, notes)
values (
  'Aura personal anomaly model',
  '1.0.0',
  'Unsupervised, per-user robust deviation model. Informational pattern detection only; not a clinical model.'
)
on conflict (name, version) do update
set notes = excluded.notes;
