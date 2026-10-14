alter table public.health_profiles
  add column if not exists blood_group text,
  add column if not exists allergies text,
  add column if not exists medications text,
  add column if not exists conditions text,
  add column if not exists doctor_name text,
  add column if not exists doctor_phone text,
  add column if not exists hospital_name text,
  add column if not exists hospital_phone text,
  add column if not exists medical_notes text;
