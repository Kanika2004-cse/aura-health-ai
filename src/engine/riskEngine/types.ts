/**
 * engine/riskEngine/types.ts
 *
 * Type definitions for the multi-modal risk evaluator.
 *
 * Three independent signals feed into RiskVerdict:
 *
 *  1. biometricStatus       — output of the existing 7-day personal-baseline
 *                             engine (decision.ts). Captures *personal* drift.
 *
 *  2. absoluteThresholdStatus — population-level clinical reference thresholds
 *                             (ACC/AHA 2017, WHO). Catches readings that are
 *                             concerning regardless of personal baseline.
 *
 *  3. symptomEscalation     — floors derived from manually-logged acute
 *                             symptoms. Prevents a borderline biometric reading
 *                             from being classified STABLE when the user has
 *                             simultaneously reported shortness of breath,
 *                             chest discomfort, etc.
 *
 * The final status is max(signal1, signal2, signal3) under the ordering
 *   STABLE < MONITOR < PRIORITY.
 *
 * IMPORTANT: This is a non-clinical, non-diagnostic software tool.
 * Classifications are for informational pattern tracking only.
 */

import type { HealthStatus } from '../../utils/healthAnalysis'

export type { HealthStatus }

// ---------------------------------------------------------------------------
// Symptom signal
// ---------------------------------------------------------------------------

/**
 * Severity weight assigned to a symptom category.
 *
 *  NONE   — symptom has no escalation effect
 *  LOW    — mild: no floor applied
 *  MEDIUM — moderate: raises floor to MONITOR if any biometric is MONITOR+
 *  HIGH   — acute: always raises floor to MONITOR; raises to PRIORITY when
 *            any biometric signal is already MONITOR
 */
export type SymptomWeight = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * The escalation outcome produced by the symptom correlator.
 *
 *  NONE           — no symptom-driven change to status
 *  MONITOR_FLOOR  — final status must be at least MONITOR
 *  PRIORITY_FLOOR — final status must be PRIORITY
 */
export type SymptomEscalation = 'NONE' | 'MONITOR_FLOOR' | 'PRIORITY_FLOOR'

// ---------------------------------------------------------------------------
// Biometric absolute-threshold signal
// ---------------------------------------------------------------------------

export type AbsoluteThresholdResult = {
  status: HealthStatus
  /** Metrics that exceeded a threshold, for display in rationale. */
  triggeringMetrics: string[]
}

// ---------------------------------------------------------------------------
// Combined verdict
// ---------------------------------------------------------------------------

export type RiskVerdict = {
  /**
   * The final synthesized status after combining all three signals.
   * This is the value that should drive UI, alerting, and storage.
   */
  finalStatus: HealthStatus

  /** Personal-baseline signal (from existing decision.ts pipeline). */
  biometricStatus: HealthStatus

  /** Population-threshold signal (from biometricRules.ts). */
  absoluteThresholdStatus: HealthStatus

  /** Symptom-driven floor applied to the final status. */
  symptomEscalation: SymptomEscalation

  /** Symptom names that triggered an escalation (empty if none). */
  triggeringSymptoms: string[]

  /** Metric names that breached absolute thresholds (empty if none). */
  triggeringMetrics: string[]

  /**
   * Human-readable explanation of *why* this verdict was reached.
   * Used in notification body and analysis UI.
   */
  rationale: string

  /** ISO-8601 timestamp when this verdict was computed. */
  evaluatedAt: string
}
