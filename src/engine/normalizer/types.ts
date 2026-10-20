/**
 * engine/normalizer/types.ts
 *
 * Canonical schema that all incoming health payloads are mapped to before
 * being handed to the risk engine or persisted in Supabase.
 *
 * All numeric fields are validated and converted to SI units:
 *   - Temperature: °C
 *   - Pressure:    mmHg
 *   - Heart rate:  bpm
 *   - SpO₂:        % (0–100)
 *   - Steps:       integer count
 *   - Sleep:       minutes of non-awake / non-inBed sleep
 *
 * Out-of-range or missing fields are represented as `null` — never as NaN,
 * undefined, or a sentinel number — so downstream consumers can use strict
 * null checks.
 */

export type WearablePlatform = 'health_connect' | 'healthkit' | 'manual'

export type NormalizedReading = {
  /** Stable identifier sourced from the platform record ID, or a synthetic
   *  composite key for readings that lack one. */
  sourceRecordId: string

  /** Which platform produced this reading. */
  platform: WearablePlatform

  /** ISO-8601 UTC timestamp of when the measurement was taken. */
  recordedAt: string

  /** Active heart rate in bpm; null if not present or out of range [20, 300]. */
  heartRateBpm: number | null

  /** Resting heart rate in bpm; null if not present or out of range [20, 300]. */
  restingHeartRateBpm: number | null

  /** Blood-oxygen saturation in percent [50, 100]. */
  spo2Pct: number | null

  /** Systolic blood pressure in mmHg [60, 260]. */
  systolicMmhg: number | null

  /** Diastolic blood pressure in mmHg [30, 160]. */
  diastolicMmhg: number | null

  /** Body temperature in °C [25, 45]. */
  temperatureC: number | null

  /** Step count; non-negative integer. */
  steps: number | null

  /** Sleep duration in minutes (awake/inBed stages excluded). */
  sleepMinutes: number | null

  /** Human-readable label for the data source, e.g. "Samsung Health". */
  sourceLabel: string
}

// ---------------------------------------------------------------------------
// Raw payload shapes from @capgo/capacitor-health
// (reproduced here so the normalizer is self-contained and testable without
//  importing the Capacitor plugin in unit-test environments)
// ---------------------------------------------------------------------------

export type RawSleepStage = {
  stage: string
  durationMinutes: number
}

export type RawHealthSample = {
  /** Platform-specific unique ID — may be absent on older Android versions. */
  platformId?: string

  dataType:
    | 'heartRate'
    | 'restingHeartRate'
    | 'oxygenSaturation'
    | 'bloodPressure'
    | 'steps'
    | 'sleep'
    | string

  startDate: string
  endDate: string

  /** Primary numeric value (e.g. heart rate bpm, SpO₂ %, step count). */
  value: number

  /** Systolic component for bloodPressure samples. */
  systolic?: number

  /** Diastolic component for bloodPressure samples. */
  diastolic?: number

  /** Sleep quality stage string (HealthKit: 'asleep', 'awake', 'inBed', …). */
  sleepState?: string

  /** Stage breakdown for sleep samples. */
  stages?: RawSleepStage[]

  /** Display name of the originating app or device. */
  sourceName?: string
}
