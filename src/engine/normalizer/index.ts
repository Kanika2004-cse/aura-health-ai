/**
 * engine/normalizer/index.ts
 *
 * Public API for the normalizer layer.
 *
 * Usage:
 *   import { normalizeHealthConnectBatch, normalizeHealthKitBatch } from '../engine/normalizer'
 *
 * The `normalizedReadingToMeasurementRow` helper converts a NormalizedReading
 * to the shape expected by `health_measurements` in Supabase, making it a
 * drop-in replacement for the `toMeasurement()` function in wearableSync.ts.
 */

export type { NormalizedReading, RawHealthSample, RawSleepStage, WearablePlatform } from './types'

export {
  normalizeHealthConnectSample,
  normalizeHealthConnectBatch,
} from './healthConnectNormalizer'

export {
  normalizeHealthKitSample,
  normalizeHealthKitBatch,
} from './healthKitNormalizer'

// ---------------------------------------------------------------------------
// Shared conversion utility
// ---------------------------------------------------------------------------

import type { NormalizedReading } from './types'

/**
 * Converts a NormalizedReading into a Supabase `health_measurements` insert
 * row. This is the single canonical mapping used by wearableSync.ts and any
 * future ingest paths.
 */
export function normalizedReadingToMeasurementRow(
  reading: NormalizedReading,
  userId: string,
) {
  return {
    user_id: userId,
    recorded_at: reading.recordedAt,
    source: reading.platform,
    source_record_id: reading.sourceRecordId,
    heart_rate_bpm: reading.heartRateBpm,
    resting_heart_rate_bpm: reading.restingHeartRateBpm,
    spo2_pct: reading.spo2Pct,
    systolic_mmhg: reading.systolicMmhg,
    diastolic_mmhg: reading.diastolicMmhg,
    temperature_c: reading.temperatureC,
    steps: reading.steps,
    sleep_minutes: reading.sleepMinutes,
    notes: `Imported from ${reading.sourceLabel}`,
  } as const
}
