/**
 * engine/riskEngine/biometricRules.ts
 *
 * Evaluates a set of biometric readings against population-level clinical
 * reference thresholds (ACC/AHA 2017 Blood Pressure Guidelines, WHO SpO₂
 * guidance, standard heart-rate reference ranges).
 *
 * This signal is INDEPENDENT of the user's personal baseline and catches
 * readings that are objectively concerning regardless of personal history.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPORTANT DISCLAIMER
 * These thresholds are reference values used for informational pattern
 * tracking in a non-clinical consumer wellness application. They are NOT
 * medical advice, NOT a diagnosis, and NOT a substitute for professional
 * medical evaluation. The app must surface this disclaimer wherever these
 * results are shown to the user.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { HealthStatus } from '../../utils/healthAnalysis'
import type { AbsoluteThresholdResult } from './types'

// ---------------------------------------------------------------------------
// Threshold tables
// ---------------------------------------------------------------------------

/**
 * Blood pressure (ACC/AHA 2017)
 *   Normal:        systolic < 120  AND diastolic < 80
 *   Elevated:      systolic 120–129 AND diastolic < 80   → MONITOR
 *   Hypertension1: systolic 130–139 OR  diastolic 80–89  → MONITOR
 *   Hypertension2: systolic ≥ 140  OR  diastolic ≥ 90   → PRIORITY
 *   Crisis:        systolic > 180  OR  diastolic > 120   → PRIORITY
 */
const BP_MONITOR_SYSTOLIC = 120
const BP_PRIORITY_SYSTOLIC = 140

const BP_MONITOR_DIASTOLIC = 80
const BP_PRIORITY_DIASTOLIC = 90

/**
 * SpO₂ (WHO / pulse-oximetry reference ranges)
 *   Normal:        ≥ 95%
 *   Low-normal:    94% → MONITOR
 *   Concerning:    < 90% → PRIORITY
 */
const SPO2_MONITOR_PCT = 94
const SPO2_PRIORITY_PCT = 90

/**
 * Heart rate (standard adult resting reference)
 *   Normal:        50–100 bpm
 *   Borderline:    40–49 or 101–120 bpm → MONITOR
 *   Concerning:    < 40 or > 120 bpm    → PRIORITY
 */
const HR_HIGH_MONITOR = 100
const HR_HIGH_PRIORITY = 120
const HR_LOW_MONITOR = 50
const HR_LOW_PRIORITY = 40

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<HealthStatus, number> = {
  STABLE: 0,
  MONITOR: 1,
  PRIORITY: 2,
}

function maxStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

// ---------------------------------------------------------------------------
// Per-metric evaluators
// ---------------------------------------------------------------------------

function evaluateBloodPressure(
  systolic: number | null,
  diastolic: number | null,
): { status: HealthStatus; label: string | null } {
  if (systolic === null && diastolic === null) {
    return { status: 'STABLE', label: null }
  }

  // Use whichever component is available; both preferred.
  const sys = systolic ?? 0
  const dia = diastolic ?? 0

  if (
    (systolic !== null && sys >= BP_PRIORITY_SYSTOLIC) ||
    (diastolic !== null && dia >= BP_PRIORITY_DIASTOLIC)
  ) {
    return {
      status: 'PRIORITY',
      label: `Blood pressure ${sys}/${dia} mmHg (Stage 2 Hypertension reference)`,
    }
  }

  if (
    (systolic !== null && sys >= BP_MONITOR_SYSTOLIC) ||
    (diastolic !== null && dia >= BP_MONITOR_DIASTOLIC)
  ) {
    return {
      status: 'MONITOR',
      label: `Blood pressure ${sys}/${dia} mmHg (Elevated / Stage 1 reference)`,
    }
  }

  return { status: 'STABLE', label: null }
}

function evaluateSpO2(
  spo2: number | null,
): { status: HealthStatus; label: string | null } {
  if (spo2 === null) return { status: 'STABLE', label: null }

  if (spo2 < SPO2_PRIORITY_PCT) {
    return {
      status: 'PRIORITY',
      label: `SpO₂ ${spo2}% (below 90% — low oxygen reference)`,
    }
  }

  if (spo2 < SPO2_MONITOR_PCT) {
    return {
      status: 'MONITOR',
      label: `SpO₂ ${spo2}% (94%–89% range — worth monitoring)`,
    }
  }

  return { status: 'STABLE', label: null }
}

function evaluateHeartRate(
  hr: number | null,
): { status: HealthStatus; label: string | null } {
  if (hr === null) return { status: 'STABLE', label: null }

  if (hr > HR_HIGH_PRIORITY || hr < HR_LOW_PRIORITY) {
    return {
      status: 'PRIORITY',
      label: `Heart rate ${hr} bpm (outside safe reference range)`,
    }
  }

  if (hr > HR_HIGH_MONITOR || hr < HR_LOW_MONITOR) {
    return {
      status: 'MONITOR',
      label: `Heart rate ${hr} bpm (borderline reference range)`,
    }
  }

  return { status: 'STABLE', label: null }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type BiometricSnapshot = {
  systolicMmhg: number | null
  diastolicMmhg: number | null
  spo2Pct: number | null
  heartRateBpm: number | null
  restingHeartRateBpm?: number | null
}

/**
 * Evaluates a set of biometric values against population-level clinical
 * reference thresholds and returns the worst-case status plus which metrics
 * triggered it.
 *
 * @param snapshot - Current biometric values (nulls are safely ignored).
 * @returns AbsoluteThresholdResult with status and human-readable labels.
 */
export function evaluateAbsoluteThresholds(
  snapshot: BiometricSnapshot,
): AbsoluteThresholdResult {
  const triggeringMetrics: string[] = []
  let status: HealthStatus = 'STABLE'

  const bpResult = evaluateBloodPressure(
    snapshot.systolicMmhg,
    snapshot.diastolicMmhg,
  )
  if (bpResult.status !== 'STABLE' && bpResult.label) {
    status = maxStatus(status, bpResult.status)
    triggeringMetrics.push(bpResult.label)
  }

  const spo2Result = evaluateSpO2(snapshot.spo2Pct)
  if (spo2Result.status !== 'STABLE' && spo2Result.label) {
    status = maxStatus(status, spo2Result.status)
    triggeringMetrics.push(spo2Result.label)
  }

  // Prefer active heart rate; fall back to resting
  const hrToCheck =
    snapshot.heartRateBpm ?? snapshot.restingHeartRateBpm ?? null
  const hrResult = evaluateHeartRate(hrToCheck)
  if (hrResult.status !== 'STABLE' && hrResult.label) {
    status = maxStatus(status, hrResult.status)
    triggeringMetrics.push(hrResult.label)
  }

  return { status, triggeringMetrics }
}
