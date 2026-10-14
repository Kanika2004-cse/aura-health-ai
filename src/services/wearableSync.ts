import { Capacitor } from '@capacitor/core'
import { Health, type HealthDataType, type HealthSample } from '@capgo/capacitor-health'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export const READABLE_HEALTH_TYPES: HealthDataType[] = [
  'heartRate',
  'restingHeartRate',
  'oxygenSaturation',
  'bloodPressure',
  'steps',
  'sleep',
]

export type WearablePlatform = 'health_connect' | 'healthkit'

export function isNativeHealthSyncAvailable() {
  return Capacitor.isNativePlatform()
}

export async function getHealthAvailability() {
  if (!isNativeHealthSyncAvailable()) return { available: false, reason: 'Open Aura on an Android or iPhone app to connect health data.' }
  return Health.isAvailable()
}

function toMeasurement(sample: HealthSample, userId: string, source: WearablePlatform) {
  const base = {
    user_id: userId,
    recorded_at: sample.startDate,
    source,
    source_record_id: sample.platformId ?? `${sample.dataType}:${sample.startDate}:${sample.endDate}:${sample.value}:${sample.systolic ?? ''}:${sample.diastolic ?? ''}`,
    heart_rate_bpm: null as number | null,
    resting_heart_rate_bpm: null as number | null,
    spo2_pct: null as number | null,
    systolic_mmhg: null as number | null,
    diastolic_mmhg: null as number | null,
    temperature_c: null as number | null,
    steps: null as number | null,
    sleep_minutes: null as number | null,
    notes: sample.sourceName ? `Imported from ${sample.sourceName}` : 'Imported from connected health data',
  }

  switch (sample.dataType) {
    case 'heartRate':
      base.heart_rate_bpm = sample.value
      break
    case 'restingHeartRate':
      base.resting_heart_rate_bpm = sample.value
      break
    case 'oxygenSaturation':
      base.spo2_pct = sample.value
      break
    case 'bloodPressure':
      base.systolic_mmhg = sample.systolic ?? null
      base.diastolic_mmhg = sample.diastolic ?? null
      break
    case 'steps':
      base.steps = Math.round(sample.value)
      break
    case 'sleep':
      if (sample.stages?.length) {
        const asleepStages = sample.stages.filter((stage) => !['awake', 'inBed'].includes(stage.stage))
        if (asleepStages.length === 0) return null
        base.sleep_minutes = Math.round(asleepStages.reduce((total, stage) => total + stage.durationMinutes, 0))
      } else {
        if (sample.sleepState === 'awake' || sample.sleepState === 'inBed') return null
        base.sleep_minutes = Math.max(0, Math.round((Date.parse(sample.endDate) - Date.parse(sample.startDate)) / 60000))
      }
      if (sample.sleepState) base.notes = `${base.notes} (sleep: ${sample.sleepState})`
      break
  }
  return base
}

export async function synchronizeHealthData(
  supabase: SupabaseClient<Database>,
  userId: string,
  days = 30,
) {
  const platform: WearablePlatform = Capacitor.getPlatform() === 'ios' ? 'healthkit' : 'health_connect'
  const availability = await getHealthAvailability()
  if (!availability.available) throw new Error(availability.reason || 'Health data is not available on this device.')

  const authorization = await Health.requestAuthorization({ read: READABLE_HEALTH_TYPES, write: [] })
  const allowed = new Set(authorization.readAuthorized)
  const denied = READABLE_HEALTH_TYPES.filter((type) => !allowed.has(type))
  if (allowed.size === 0) throw new Error('No health data permissions were granted. You can enable access in your device health settings.')

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const samples: HealthSample[] = []
  for (const dataType of READABLE_HEALTH_TYPES) {
    if (!allowed.has(dataType)) continue
    const result = await Health.readSamples({
      dataType,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      // The plugin treats 0 as no cap and pages Health Connect reads internally.
      limit: 0,
      ascending: true,
    })
    samples.push(...result.samples)
  }

  const rows = samples.flatMap((sample) => {
    const row = toMeasurement(sample, userId, platform)
    return row ? [row] : []
  })
  const db = supabase as SupabaseClient<any>
  let inserted = 0
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500)
    const { data, error } = await db
      .from('health_measurements')
      .upsert(batch, { onConflict: 'user_id,source,source_record_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Readings were found but could not be saved to Aura: ${error.message}`)
    inserted += data?.length ?? 0
  }

  const displayName = platform === 'healthkit' ? 'Apple Health' : 'Health Connect'
  const { error: deviceError } = await db.from('connected_devices').upsert({
    user_id: userId,
    name: displayName,
    device_type: platform,
    status: 'connected',
    last_synced_at: end.toISOString(),
  }, { onConflict: 'user_id,name' })
  if (deviceError) throw new Error(`Readings synced, but the connection status could not be saved: ${deviceError.message}`)

  return { inserted, totalRead: samples.length, denied }
}
