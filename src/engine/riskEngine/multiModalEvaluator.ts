/**
 * engine/riskEngine/multiModalEvaluator.ts
 *
 * The central risk synthesis function.
 *
 * It combines three independent signals into a single RiskVerdict:
 *
 *   Signal 1 — biometricStatus        (personal 7-day baseline, existing pipeline)
 *   Signal 2 — absoluteThresholdStatus (population clinical reference, biometricRules.ts)
 *   Signal 3 — symptomEscalation       (acute symptom floor, symptomCorrelator.ts)
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  FALSE-STABLE PREVENTION                                              │
 * │                                                                       │
 * │  Under the personal-baseline-only approach (decision.ts), a reading   │
 * │  of 135/80 mmHg is classified STABLE if it is within 10% of the      │
 * │  user's recent baseline, even when "Shortness of breath" is logged.   │
 * │                                                                       │
 * │  This evaluator prevents that by applying cross-signal escalation:    │
 * │                                                                       │
 * │    HIGH symptom + any biometric MONITOR → PRIORITY                   │
 * │    HIGH symptom + biometrics STABLE     → MONITOR                    │
 * │    MEDIUM symptom + any biometric       → at least MONITOR           │
 * │    Any single signal PRIORITY           → final is PRIORITY          │
 * └───────────────────────────────────────────────────────────────────────┘
 */

import type { HealthStatus } from '../../utils/healthAnalysis'
import { evaluateAbsoluteThresholds, type BiometricSnapshot } from './biometricRules'
import { correlateSymptoms, type SymptomInput } from './symptomCorrelator'
import type { SymptomEscalation, RiskVerdict } from './types'

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

function applyFloor(
  status: HealthStatus,
  floor: SymptomEscalation,
): HealthStatus {
  if (floor === 'PRIORITY_FLOOR') return 'PRIORITY'
  if (floor === 'MONITOR_FLOOR') return maxStatus(status, 'MONITOR')
  return status
}

function buildRationale(
  biometricStatus: HealthStatus,
  absoluteThresholdStatus: HealthStatus,
  symptomEscalation: SymptomEscalation,
  triggeringSymptoms: string[],
  triggeringMetrics: string[],
  finalStatus: HealthStatus,
): string {
  const parts: string[] = []

  if (finalStatus === 'STABLE') {
    return 'Biometrics are within your personal pattern and reference ranges. No escalating symptoms reported.'
  }

  if (biometricStatus !== 'STABLE') {
    parts.push(
      `Personal pattern signal: ${biometricStatus.toLowerCase()} (deviation from your 7-day baseline).`,
    )
  }

  if (absoluteThresholdStatus !== 'STABLE' && triggeringMetrics.length > 0) {
    parts.push(
      `Reference threshold signal: ${absoluteThresholdStatus.toLowerCase()} — ${triggeringMetrics.join('; ')}.`,
    )
  }

  if (
    symptomEscalation !== 'NONE' &&
    triggeringSymptoms.length > 0
  ) {
    const floor =
      symptomEscalation === 'PRIORITY_FLOOR' ? 'priority' : 'monitor'
    parts.push(
      `Symptom signal: reported ${triggeringSymptoms.join(', ')} raised the floor to ${floor}.`,
    )
  }

  if (parts.length === 0) {
    parts.push(`Status: ${finalStatus.toLowerCase()}.`)
  }

  parts.push(
    'This is an informational pattern assessment, not a medical diagnosis.',
  )

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export type MultiModalInput = {
  /**
   * Output of combineDecisionStatuses() from the existing personal-baseline
   * pipeline (decision.ts / healthAnalysis.ts).
   */
  biometricStatus: HealthStatus

  /**
   * Current biometric values — used by biometricRules.ts to compute the
   * population-threshold signal.
   */
  snapshot: BiometricSnapshot

  /**
   * Acute symptoms logged within the configurable time window.
   * Accepts plain strings (as returned by personalAnomalyModel.nearbySymptoms)
   * or full SymptomInput objects that carry severity.
   */
  symptoms: Array<string | SymptomInput>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesizes three independent health signals into a single RiskVerdict.
 *
 * This is the primary entry point for the risk engine. Call it after running
 * analyzeHealthHistory() + combineDecisionStatuses() on the most recent
 * measurements.
 *
 * @example
 * ```ts
 * import { analyzeHealthHistory } from '../../utils/healthAnalysis'
 * import { evaluateMultiModalRisk } from '../../engine/riskEngine'
 *
 * const analysis = analyzeHealthHistory(measurements)
 *
 * const verdict = evaluateMultiModalRisk({
 *   biometricStatus: analysis.status,
 *   snapshot: {
 *     systolicMmhg: 135,
 *     diastolicMmhg: 80,
 *     spo2Pct: null,
 *     heartRateBpm: null,
 *   },
 *   symptoms: ['Shortness of breath'],
 * })
 * // verdict.finalStatus === 'PRIORITY'  ← false-stable prevented
 * ```
 */
export function evaluateMultiModalRisk(
  input: MultiModalInput,
): RiskVerdict {
  const evaluatedAt = new Date().toISOString()

  // ------------------------------------------------------------------
  // Signal 2: population-level absolute thresholds
  // ------------------------------------------------------------------
  const absoluteResult = evaluateAbsoluteThresholds(input.snapshot)
  const absoluteThresholdStatus = absoluteResult.status
  const triggeringMetrics = absoluteResult.triggeringMetrics

  // ------------------------------------------------------------------
  // Signal 3: symptom correlation
  // ------------------------------------------------------------------
  const symptomResult = correlateSymptoms(input.symptoms)
  const { worstWeight, escalatingSymptoms } = symptomResult
  const triggeringSymptoms = escalatingSymptoms

  // ------------------------------------------------------------------
  // Cross-signal escalation (the key false-stable prevention step)
  //
  // Start with the raw maximum of the two biometric signals.
  // Then apply symptom-driven cross-escalation.
  // ------------------------------------------------------------------

  const rawBiometricMax = maxStatus(
    input.biometricStatus,
    absoluteThresholdStatus,
  )

  let symptomEscalation: SymptomEscalation = 'NONE'

  if (worstWeight === 'HIGH') {
    // HIGH acute symptom: escalate biometric MONITOR → PRIORITY
    //                     or biometric STABLE → MONITOR
    if (rawBiometricMax === 'MONITOR' || rawBiometricMax === 'PRIORITY') {
      symptomEscalation = 'PRIORITY_FLOOR'
    } else {
      // rawBiometricMax === 'STABLE'
      symptomEscalation = 'MONITOR_FLOOR'
    }
  } else if (worstWeight === 'MEDIUM') {
    // MEDIUM symptom: always at least MONITOR, but does NOT push to PRIORITY
    symptomEscalation = 'MONITOR_FLOOR'
  }
  // LOW → NONE

  // ------------------------------------------------------------------
  // Final status
  // ------------------------------------------------------------------
  const finalStatus = applyFloor(rawBiometricMax, symptomEscalation)

  const rationale = buildRationale(
    input.biometricStatus,
    absoluteThresholdStatus,
    symptomEscalation,
    triggeringSymptoms,
    triggeringMetrics,
    finalStatus,
  )

  return {
    finalStatus,
    biometricStatus: input.biometricStatus,
    absoluteThresholdStatus,
    symptomEscalation,
    triggeringSymptoms,
    triggeringMetrics,
    rationale,
    evaluatedAt,
  }
}
