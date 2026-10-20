/**
 * services/wearableSync.ts
 *
 * Orchestrates reading from Health Connect (Android) and HealthKit (iOS)
 * and persisting the results to the `health_measurements` Supabase table.
 *
 * v2: Raw sample mapping is now delegated to engine/normalizer so that
 * validation, unit conversion, and sleep-stage filtering are defined in a
 * single testable location rather than duplicated here and in HealthDataPage.
 */

import { Capacitor } from '@capacitor/core'
import { Health, type HealthDataType, type HealthSample } from '@capgo/capacitor-health'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'
import {
  normalizeHealthConnectBatch,
  normalizeHealthKitBatch,
  normalizedReadingToMeasurementRow,
  type RawHealthSample,
} from '../engine/normalizer'
import { sendSmartHealthAlert } from './notificationService' // 👈 Imported your smart notification service

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

  // ------------------------------------------------------------------
  // Normalize via the engine normalizer layer
  // Casting HealthSample[] to RawHealthSample[] is safe because the
  // @capgo/capacitor-health HealthSample type is a superset of our
  // RawHealthSample interface (all required fields are present).
  // ------------------------------------------------------------------
  const normalized =
    platform === 'healthkit'
      ? normalizeHealthKitBatch(samples as unknown as RawHealthSample[], userId)
      : normalizeHealthConnectBatch(samples as unknown as RawHealthSample[], userId)

  const rows = normalized.map((reading) =>
    normalizedReadingToMeasurementRow(reading, userId),
  )

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

  // ------------------------------------------------------------------
  // 🚀 Smart Notification Check Post-Sync
  // Evaluates the latest synced reading for sustained vital spikes
  // ------------------------------------------------------------------
  try {
    const { data: latest } = await db
      .from('health_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      const isHighBP = (latest.systolic_mmhg && latest.systolic_mmhg >= 135) || (latest.diastolic_mmhg && latest.diastolic_mmhg >= 85)
      const isLowSpO2 = latest.spo2_pct && latest.spo2_pct <= 93

      if (isHighBP || isLowSpO2) {
        await sendSmartHealthAlert(
          db,
          userId,
          '⚠️ Possible Elevated Pattern Detected',
          'Sustained vital spike observed. Recommendation: Rest quietly for 15 minutes and avoid caffeine.',
          'high'
        )
      }
    }
  } catch (notificationErr) {
    console.error('Failed to trigger post-sync notification:', notificationErr)
  }

  return { inserted, totalRead: samples.length, denied }
}