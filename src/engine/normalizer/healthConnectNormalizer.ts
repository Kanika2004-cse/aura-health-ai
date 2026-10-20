/**
 * engine/normalizer/healthConnectNormalizer.ts
 *
 * Maps raw JSON samples from the Health Connect plugin
 * (@capgo/capacitor-health on Android) to the canonical NormalizedReading
 * schema.
 *
 * Design rules:
 *  - Returns `null` for any field that is absent, non-finite, or outside the
 *    accepted physiological range. Never throws for bad field values.
 *  - Mirrors the validation guards already present in HealthDataPage.validate()
 *    so the two paths produce equivalent output.
 *  - Sleep: only non-awake / non-inBed stages are accumulated. If the sample
 *    has no qualifying stages it returns null (same logic as wearableSync.ts).
 */

import type { NormalizedReading, RawHealthSample } from './types'

// ---------------------------------------------------------------------------
// Range constants (physiological sanity bounds, not clinical thresholds)
// ---------------------------------------------------------------------------

const HEART_RATE_MIN = 20
const HEART_RATE_MAX = 300
const SPO2_MIN = 50
const SPO2_MAX = 100
const SYSTOLIC_MIN = 60
const SYSTOLIC_MAX = 260
const DIASTOLIC_MIN = 30
const DIASTOLIC_MAX = 160
const TEMPERATURE_C_MIN = 25
const TEMPERATURE_C_MAX = 45
const STEPS_MIN = 0
const STEPS_MAX = 200_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampOrNull(
  value: number | undefined | null,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  if (value < min || value > max) return null
  return value
}

function syntheticId(sample: RawHealthSample): string {
  return (
    sample.platformId ??
    [
      sample.dataType,
      sample.startDate,
      sample.endDate,
      sample.value,
      sample.systolic ?? '',
      sample.diastolic ?? '',
    ].join(':')
  )
}

const AWAKE_STAGES = new Set(['awake', 'inBed'])

function computeSleepMinutes(sample: RawHealthSample): number | null {
  if (sample.stages?.length) {
    const asleep = sample.stages.filter(
      (s) => !AWAKE_STAGES.has(s.stage),
    )
    if (asleep.length === 0) return null
    const total = asleep.reduce((sum, s) => sum + s.durationMinutes, 0)
    return Math.round(total)
  }

  if (
    sample.sleepState === 'awake' ||
    sample.sleepState === 'inBed'
  ) {
    return null
  }

  const startMs = Date.parse(sample.startDate)
  const endMs = Date.parse(sample.endDate)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  return Math.max(0, Math.round((endMs - startMs) / 60_000))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a single raw Health Connect sample into a NormalizedReading.
 *
 * Returns `null` for samples that carry no meaningful health data after
 * validation (e.g. sleep samples consisting entirely of awake/inBed stages).
 */
export function normalizeHealthConnectSample(
  sample: RawHealthSample,
  userId: string,
): NormalizedReading | null {
  const base: NormalizedReading = {
    sourceRecordId: syntheticId(sample),
    platform: 'health_connect',
    recordedAt: sample.startDate,
    heartRateBpm: null,
    restingHeartRateBpm: null,
    spo2Pct: null,
    systolicMmhg: null,
    diastolicMmhg: null,
    temperatureC: null,
    steps: null,
    sleepMinutes: null,
    sourceLabel: sample.sourceName
      ? `Health Connect — ${sample.sourceName}`
      : 'Health Connect',
  }

  // Suppress unused-variable lint for userId — reserved for audit logging
  void userId

  switch (sample.dataType) {
    case 'heartRate':
      base.heartRateBpm = clampOrNull(
        sample.value,
        HEART_RATE_MIN,
        HEART_RATE_MAX,
      )
      break

    case 'restingHeartRate':
      base.restingHeartRateBpm = clampOrNull(
        sample.value,
        HEART_RATE_MIN,
        HEART_RATE_MAX,
      )
      break

    case 'oxygenSaturation':
      base.spo2Pct = clampOrNull(sample.value, SPO2_MIN, SPO2_MAX)
      break

    case 'bodyTemperature':
    case 'temperature':
      base.temperatureC = clampOrNull(
        sample.value,
        TEMPERATURE_C_MIN,
        TEMPERATURE_C_MAX,
      )
      break

    case 'bloodPressure':
      base.systolicMmhg = clampOrNull(
        sample.systolic,
        SYSTOLIC_MIN,
        SYSTOLIC_MAX,
      )
      base.diastolicMmhg = clampOrNull(
        sample.diastolic,
        DIASTOLIC_MIN,
        DIASTOLIC_MAX,
      )
      // Reject readings where diastolic >= systolic (physiologically invalid)
      if (
        base.systolicMmhg !== null &&
        base.diastolicMmhg !== null &&
        base.diastolicMmhg >= base.systolicMmhg
      ) {
        base.systolicMmhg = null
        base.diastolicMmhg = null
      }
      break

    case 'steps': {
      const rounded = Math.round(sample.value)
      base.steps = clampOrNull(rounded, STEPS_MIN, STEPS_MAX)
      break
    }

    case 'sleep': {
      const sleepMins = computeSleepMinutes(sample)
      if (sleepMins === null) return null
      base.sleepMinutes = sleepMins
      break
    }

    default:
      // Unknown data type — return a reading with all nulls so the caller
      // can decide whether to discard it.
      break
  }

  return base
}

/**
 * Batch-converts an array of raw Health Connect samples.
 * Filters out nulls so the returned array contains only valid readings.
 */
export function normalizeHealthConnectBatch(
  samples: RawHealthSample[],
  userId: string,
): NormalizedReading[] {
  return samples.flatMap((sample) => {
    const reading = normalizeHealthConnectSample(sample, userId)
    return reading ? [reading] : []
  })
}
