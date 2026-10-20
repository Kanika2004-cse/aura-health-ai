/**
 * engine/riskEngine/index.ts
 *
 * Public API for the risk evaluation engine.
 */

export type {
  HealthStatus,
  SymptomWeight,
  SymptomEscalation,
  AbsoluteThresholdResult,
  RiskVerdict,
} from './types'

export type { BiometricSnapshot } from './biometricRules'
export { evaluateAbsoluteThresholds } from './biometricRules'

export type { SymptomInput, SymptomCorrelationResult } from './symptomCorrelator'
export { correlateSymptoms } from './symptomCorrelator'

export type { MultiModalInput } from './multiModalEvaluator'
export { evaluateMultiModalRisk } from './multiModalEvaluator'
