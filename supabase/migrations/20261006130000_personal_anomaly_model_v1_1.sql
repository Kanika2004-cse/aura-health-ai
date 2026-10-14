insert into public.model_versions (name, version, notes)
values (
  'Aura personal anomaly model',
  '1.1.0',
  'Per-user robust deviation model with previous-reading comparison. Informational pattern detection only; not a clinical or predictive model.'
)
on conflict (name, version) do update
set notes = excluded.notes;
