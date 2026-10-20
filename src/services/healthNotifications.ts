/**
 * services/healthNotifications.ts
 *
 * Thin compatibility wrapper that preserves the existing call signature
 * (`notifyHealthUpdate(measurements)`) while delegating the full
 * notification lifecycle to engine/alerting/alertService.
 *
 * New code should call `fireAlert(verdict)` directly from engine/alerting.
 * This wrapper exists so that existing call sites in HealthDataPage.tsx
 * continue to work without changes until they are migrated to the richer
 * evaluateMultiModalRisk + fireAlert pattern.
 *
 * Permission management is also delegated to the alert service, which handles
 * both Capacitor LocalNotifications and the Web Notifications API.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { analyzeHealthHistory, type MeasurementForAnalysis } from '../utils/healthAnalysis'
import { evaluateMultiModalRisk } from '../engine/riskEngine/multiModalEvaluator'
import { fireAlert } from '../engine/alerting/alertService'

// Re-export permission helper so existing callers of
// requestHealthNotificationPermission() continue to work.
export async function requestHealthNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  }

  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

/**
 * Compatibility shim: accepts the last N measurements, runs the full
 * multi-modal risk evaluation, and fires an alert if warranted.
 *
 * The most recent measurement's biometrics are used as the snapshot for
 * absolute threshold evaluation.
 */
export async function notifyHealthUpdate(
  measurements: MeasurementForAnalysis[],
): Promise<void> {
  if (!measurements.length) return

  const sorted = [...measurements].sort(
    (a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at),
  )

  // Run the existing personal-baseline analysis pipeline
  const analysis = analyzeHealthHistory(sorted)

  // Build a biometric snapshot from the most recent reading
  const latest = sorted[0]
  const snapshot = {
    systolicMmhg: latest.systolic_mmhg ?? null,
    diastolicMmhg: latest.diastolic_mmhg ?? null,
    spo2Pct: latest.spo2_pct ?? null,
    heartRateBpm: latest.heart_rate_bpm ?? null,
  }

  // Run the multi-modal evaluator (symptoms are not available in the legacy
  // call path — HealthDataPage.tsx's post-save handler passes them directly)
  const verdict = evaluateMultiModalRisk({
    biometricStatus: analysis.status,
    snapshot,
    symptoms: [],
  })

  await fireAlert(verdict)
}
