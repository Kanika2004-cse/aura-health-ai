/**
 * engine/alerting/index.ts
 *
 * Public API for the alerting layer.
 */

export type {
  AlertSeverity,
  AlertChannel,
  AlertPayload,
  AlertDedupState,
} from './types'

export type { FireAlertOptions } from './alertService'
export { fireAlert, clearAlertDedupState } from './alertService'
