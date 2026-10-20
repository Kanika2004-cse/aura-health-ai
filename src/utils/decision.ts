/**
 * utils/decision.ts
 *
 * Converts per-metric evidence into STABLE / MONITOR / PRIORITY status values
 * and combines them into an overall health status.
 *
 * Phase 1 / Phase 2 foundation — this is NOT a clinical diagnostic tool.
 *
 * v2 change: decideMetricStatus() now accepts an optional `nearbySymptoms`
 * array so that acute symptoms logged within the measurement window can be
 * considered when producing the metric-level status. The cross-signal
 * escalation is fully implemented in engine/riskEngine/multiModalEvaluator.ts;
 * this layer surfaces a simple symptom flag that callers of decideMetricStatus
 * can use to indicate whether symptom context exists.
 */

import type {
  HealthMetricKey,
  HealthStatus,
} from './healthAnalysis'

import { correlateSymptoms } from '../engine/riskEngine/symptomCorrelator'
import type { SymptomInput } from '../engine/riskEngine/symptomCorrelator'

export type MetricDecisionEvidence = {
  metric: HealthMetricKey
  current: number | null
  baseline: number | null
  deviationPercent: number | null
  historyCount: number

  /**
   * Number of recent previous readings that moved
   * in the same direction as the current deviation.
   */
  persistentReadings: number

  /**
   * Number of recent readings available for evaluating
   * persistence.
   */
  persistenceWindow: number

  /**
   * Whether the current deviation is meaningfully
   * different from the available personal pattern.
   */
  hasMeaningfulDeviation: boolean

  /**
   * Acute symptoms logged near this measurement.
   * Accepts plain strings (as returned by personalAnomalyModel.nearbySymptoms)
   * or full SymptomInput objects that carry severity scores.
   *
   * When at least one HIGH-weight symptom is present and the metric deviation
   * is meaningful, the status floor is raised to MONITOR to prevent false
   * STABLE classifications.
   */
  nearbySymptoms?: Array<string | SymptomInput>
}

export type DecisionEvidence = {
  metric: HealthMetricKey
  current: number | null
  baseline: number | null
  deviationPercent: number | null
  historyCount: number
  persistentReadings: number
  persistenceWindow: number
  hasMeaningfulDeviation: boolean
  nearbySymptoms?: Array<string | SymptomInput>
}

function getDeviationDirection(
  deviationPercent: number | null,
): 'UP' | 'DOWN' | 'NONE' {
  if (
    deviationPercent === null ||
    !Number.isFinite(deviationPercent) ||
    deviationPercent === 0
  ) {
    return 'NONE'
  }

  return deviationPercent > 0 ? 'UP' : 'DOWN'
}

/**
 * Converts the current metric evidence into a status.
 *
 * Important:
 * This is a temporary Phase-1/Phase-2 decision foundation.
 * It is NOT a clinical rule and does not diagnose disease.
 *
 * The important architectural change is that deviation alone
 * is no longer enough to create a Priority state.
 *
 * v2: When `nearbySymptoms` contains HIGH-weight symptoms (shortness of
 * breath, chest discomfort) and a meaningful deviation exists, the returned
 * status is raised to at least MONITOR — preventing false STABLE results.
 * Full multi-signal synthesis (including population thresholds) is performed
 * by evaluateMultiModalRisk() in engine/riskEngine/multiModalEvaluator.ts.
 */
export function decideMetricStatus(
  evidence: MetricDecisionEvidence,
): HealthStatus {
  if (
    evidence.current === null ||
    evidence.baseline === null ||
    evidence.deviationPercent === null
  ) {
    return 'STABLE'
  }

  if (!evidence.hasMeaningfulDeviation) {
    // Even with no personal-pattern deviation, check if HIGH acute symptoms
    // are present — they warrant at least a MONITOR flag.
    if (evidence.nearbySymptoms?.length) {
      const correlation = correlateSymptoms(evidence.nearbySymptoms)
      if (correlation.worstWeight === 'HIGH') {
        return 'MONITOR'
      }
    }
    return 'STABLE'
  }

  /**
   * We require more than a single isolated deviation
   * before creating a Priority state.
   *
   * A meaningful deviation with limited history becomes
   * Monitor while Aura gathers more evidence.
   */
  const hasRepeatedEvidence =
    evidence.persistentReadings >= 2

  const hasStrongPersistence =
    evidence.persistenceWindow >= 3 &&
    evidence.persistentReadings >= 3

  /**
   * Direction is retained explicitly because later context
   * and metric-specific logic can use it.
   *
   * For now we do not treat "up" or "down" itself as
   * clinically good or bad.
   */
  const direction = getDeviationDirection(
    evidence.deviationPercent,
  )

  if (direction === 'NONE') {
    return 'STABLE'
  }

  // ------------------------------------------------------------------
  // Symptom-aware elevation
  //
  // If HIGH-weight acute symptoms are present alongside a meaningful
  // deviation, we raise the floor:
  //   hasStrongPersistence + HIGH symptom → PRIORITY
  //   hasRepeatedEvidence  + HIGH symptom → PRIORITY
  //   any deviation        + HIGH symptom → MONITOR (floor)
  // ------------------------------------------------------------------
  let symptomFloor: HealthStatus = 'STABLE'

  if (evidence.nearbySymptoms?.length) {
    const correlation = correlateSymptoms(evidence.nearbySymptoms)
    if (correlation.worstWeight === 'HIGH') {
      symptomFloor = hasRepeatedEvidence ? 'PRIORITY' : 'MONITOR'
    } else if (correlation.worstWeight === 'MEDIUM') {
      symptomFloor = 'MONITOR'
    }
  }

  const STATUS_RANK: Record<HealthStatus, number> = {
    STABLE: 0,
    MONITOR: 1,
    PRIORITY: 2,
  }

  function maxStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
    return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
  }

  if (hasStrongPersistence) {
    return maxStatus('PRIORITY', symptomFloor)
  }

  if (hasRepeatedEvidence) {
    return maxStatus('MONITOR', symptomFloor)
  }

  return maxStatus('MONITOR', symptomFloor)
}

/**
 * Combines metric-level decisions.
 *
 * Multiple Monitor signals can increase the importance
 * of the overall state, but Priority still requires
 * meaningful repeated evidence from at least one metric.
 */
export function combineDecisionStatuses(
  analyses: Array<{
    status: HealthStatus
    current: number | null
  }>,
): HealthStatus {
  const validAnalyses = analyses.filter(
    (analysis) => analysis.current !== null,
  )

  if (validAnalyses.length === 0) {
    return 'STABLE'
  }

  if (
    validAnalyses.some(
      (analysis) => analysis.status === 'PRIORITY',
    )
  ) {
    return 'PRIORITY'
  }

  if (
    validAnalyses.some(
      (analysis) => analysis.status === 'MONITOR',
    )
  ) {
    return 'MONITOR'
  }

  return 'STABLE'
}