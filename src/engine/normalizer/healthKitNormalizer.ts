/**
 * engine/normalizer/healthKitNormalizer.ts
 *
 * Maps raw JSON samples from the HealthKit plugin
 * (@capgo/capacitor-health on iOS) to the canonical NormalizedReading schema.
 *
 * HealthKit differences vs Health Connect:
 *  - Temperature is delivered in °F on some older HealthKit integrations;
 *    we detect and convert automatically.
 *  - SpO₂ is delivered as a fraction (0.0–1.0) on some source apps;
 *    we normalise to a percentage.
 *  - Sleep stages use HealthKit naming: 'asleep', 'awake', 'inBed', 'core',
 *    'deep', 'rem'.
 */

import type { NormalizedReading, RawHealthSample } from './types'

// ---------------------------------------------------------------------------
// Range constants (shared with healthConnectNormalizer but kept local to keep
// each file independently testable without a shared helper import)
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

// HealthKit delivers body temperature in °F when the locale is imperial.
// We heuristically detect Fahrenheit by checking if the value is in the
// plausible human-Fahrenheit range but outside the Celsius range.
const FAHRENHEIT_LOWER = 77   // corresponds to 25 °C
const FAHRENHEIT_UPPER = 113  // corresponds to 45 °C

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

function normalizeTemperature(raw: number): number | null {
  if (!Number.isFinite(raw)) return null

  // Already in a valid Celsius range
  if (raw >= TEMPERATURE_C_MIN && raw <= TEMPERATURE_C_MAX) {
    return raw
  }

  // Looks like Fahrenheit — convert
  if (raw >= FAHRENHEIT_LOWER && raw <= FAHRENHEIT_UPPER) {
    const celsius = (raw - 32) * (5 / 9)
    return clampOrNull(celsius, TEMPERATURE_C_MIN, TEMPERATURE_C_MAX)
  }

  return null
}

function normalizeSpo2(raw: number): number | null {
  if (!Number.isFinite(raw)) return null

  // Delivered as a fraction [0, 1]
  if (raw >= 0 && raw <= 1) {
    return clampOrNull(raw * 100, SPO2_MIN, SPO2_MAX)
  }

  // Already in percentage
  return clampOrNull(raw, SPO2_MIN, SPO2_MAX)
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

// HealthKit stages considered as actual sleep (not awake/in-bed time)
const AWAKE_HK_STAGES = new Set(['awake', 'inBed'])

function computeSleepMinutes(sample: RawHealthSample): number | null {
  if (sample.stages?.length) {
    const asleep = sample.stages.filter(
      (s) => !AWAKE_HK_STAGES.has(s.stage),
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
 * Converts a single raw HealthKit sample into a NormalizedReading.
 *
 * Returns `null` for samples with no qualifying data (e.g. pure inBed sleep).
 */
export function normalizeHealthKitSample(
  sample: RawHealthSample,
  userId: string,
): NormalizedReading | null {
  const base: NormalizedReading = {
    sourceRecordId: syntheticId(sample),
    platform: 'healthkit',
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
      ? `Apple Health — ${sample.sourceName}`
      : 'Apple Health',
  }

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
      base.spo2Pct = normalizeSpo2(sample.value)
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
      if (
        base.systolicMmhg !== null &&
        base.diastolicMmhg !== null &&
        base.diastolicMmhg >= base.systolicMmhg
      ) {
        base.systolicMmhg = null
        base.diastolicMmhg = null
      }
      break

    case 'bodyTemperature':
    case 'temperature':
      base.temperatureC = normalizeTemperature(sample.value)
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
      break
  }

  return base
}

/**
 * Batch-converts an array of raw HealthKit samples.
 */
export function normalizeHealthKitBatch(
  samples: RawHealthSample[],
  userId: string,
): NormalizedReading[] {
  return samples.flatMap((sample) => {
    const reading = normalizeHealthKitSample(sample, userId)
    return reading ? [reading] : []
  })
}
