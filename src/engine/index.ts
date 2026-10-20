/**
 * engine/index.ts
 *
 * Top-level barrel for the Aura engine layer.
 *
 * Usage:
 *   import { evaluateMultiModalRisk, fireAlert } from '../engine'
 *   import type { RiskVerdict, NormalizedReading } from '../engine'
 */

// Normalizer
export type {
  NormalizedReading,
  RawHealthSample,
  RawSleepStage,
  WearablePlatform,
} from './normalizer'
export {
  normalizeHealthConnectSample,
  normalizeHealthConnectBatch,
  normalizeHealthKitSample,
  normalizeHealthKitBatch,
  normalizedReadingToMeasurementRow,
} from './normalizer'

// Risk engine
export type {
  HealthStatus,
  SymptomWeight,
  SymptomEscalation,
  AbsoluteThresholdResult,
  RiskVerdict,
  BiometricSnapshot,
  SymptomInput,
  SymptomCorrelationResult,
  MultiModalInput,
} from './riskEngine'
export {
  evaluateAbsoluteThresholds,
  correlateSymptoms,
  evaluateMultiModalRisk,
} from './riskEngine'

// Alerting
export type {
  AlertSeverity,
  AlertChannel,
  AlertPayload,
  AlertDedupState,
  FireAlertOptions,
} from './alerting'
export { fireAlert, clearAlertDedupState } from './alerting'
